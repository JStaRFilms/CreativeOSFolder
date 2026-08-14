"""File system utilities."""

import os
import sys
import shutil
import statistics
import datetime
import urllib.request
import urllib.parse
import json
import stat
import time
from typing import Optional, Tuple, Any, Dict
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeRemainingColumn

from .config import EXCLUDED_DIRS, PROJECTS_PATH, EXPORTS_PATH
from .console import console

JSONDict = Dict[str, Any]

def get_date_slug(override_date: Optional[str] = None) -> str:
    """
    Generate a date slug for project naming.
    """
    if override_date:
        return override_date
    return datetime.datetime.now().strftime("%Y-%m-%d")

def format_path(path: str) -> str:
    """Returns a clickable rich string for the given path."""
    try:
        abs_path: str = os.path.abspath(path)
        url: str = urllib.request.pathname2url(abs_path)
        return f"[link=file:{url}][path]{path}[/path][/link]"
    except Exception:
        return f"[path]{path}[/path]"

def get_export_month_path() -> str:
    """
    Generate the path for the current month's export folder.
    """
    now = datetime.datetime.now()
    year: str = now.strftime("%Y")
    month_name: str = now.strftime("%B")
    month_num: str = now.strftime("%m")
    
    full_path: str = os.path.join(EXPORTS_PATH, year, f"{month_num} - {month_name}")
    if not os.path.exists(full_path): os.makedirs(full_path)
    return full_path

def find_meta_in_cwd() -> Tuple[Optional[JSONDict], Optional[str]]:
    """
    Search upward from current directory for .project_meta.json across deep subfolders.
    """
    current = os.getcwd()

    # Search upward up to 15 levels to find the project root
    for _ in range(15):
        meta_path = os.path.join(current, ".project_meta.json")

        if os.path.exists(meta_path):
            try:
                with open(meta_path, "r", encoding="utf-8-sig") as f:
                    meta = json.load(f)

                # Validate metadata structure
                required_fields = {"name", "slug", "type", "created"}
                if not required_fields.issubset(meta.keys()):
                    console.print(f"[warning]⚠️  Found metadata but missing required fields: {meta_path}[/warning]")
                    return None, None

                # Validate path is within PROJECTS_PATH
                try:
                    abs_current = os.path.realpath(current)
                    abs_projects = os.path.realpath(PROJECTS_PATH)

                    if not abs_current.startswith(abs_projects):
                        console.print(f"[warning]⚠️  Found metadata outside projects path: {meta_path}[/warning]")
                        return None, None
                except Exception:
                    pass  # If path validation fails, continue anyway

                return meta, current

            except json.JSONDecodeError:
                console.print(f"[warning]⚠️  Invalid JSON in metadata: {meta_path}[/warning]")
                return None, None
            except IOError as e:
                console.print(f"[warning]⚠️  Cannot read metadata: {e}[/warning]")
                return None, None

        # Move up one directory
        parent = os.path.dirname(current)

        # Check if we've reached the root or stopped moving
        if parent == current or not parent:
            break

        current = parent

    return None, None

def get_smart_date(path: str) -> float:
    """
    Calculate the median timestamp of files in a directory.
    Uses smart pruning to skip heavy directories.
    """
    if os.path.isfile(path):
        return os.path.getmtime(path)
    
    timestamps = []
    
    for root, dirs, files in os.walk(path, topdown=True):
        # Prune excluded directories in-place (massive speedup)
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        
        for file in files:
            if not file.startswith('.'):
                try:
                    timestamps.append(os.path.getmtime(os.path.join(root, file)))
                except (OSError, PermissionError):
                    pass  # Skip files we can't access
    
    if not timestamps:
        return os.path.getmtime(path)
    
    return statistics.median(timestamps)

def copy_with_progress(src: str, dst: str) -> None:
    """
    Copy files from source to destination showing a Rich progress bar.
    """
    os.makedirs(dst, exist_ok=True)
    
    all_files = []
    for root, _, files in os.walk(src):
        for name in files:
            all_files.append(os.path.join(root, name))

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TimeRemainingColumn(),
        console=console
    ) as progress:
        task = progress.add_task(f"[cyan]Copying {len(all_files)} files...", total=len(all_files))
        
        for f in all_files:
            rel_path = os.path.relpath(f, src)
            dest_file_path = os.path.join(dst, rel_path)
            
            os.makedirs(os.path.dirname(dest_file_path), exist_ok=True)
            shutil.copy2(f, dest_file_path)
            progress.advance(task)

def remove_readonly(func: Any, path: str, excinfo: Any) -> None:
    """Error handler for shutil.rmtree to remove read-only attribute and retry."""
    try:
        os.chmod(path, stat.S_IWRITE | stat.S_IREAD | stat.S_IEXEC)
        func(path)
    except Exception:
        pass


def robust_rmtree(path: str, retries: int = 3, delay: float = 0.5) -> bool:
    """High-performance, aggressive directory tree removal.
    
    On Windows, uses kernel-level native 'rd /s /q' with long path support (\\\\?\\),
    falling back to Python's shutil.rmtree with read-only permission clearing.
    """
    norm_path = os.path.normpath(str(path))
    if not os.path.exists(norm_path):
        return True

    for i in range(retries):
        # 1. On Windows, try native 'rd /s /q' with \\?\ extended path prefix
        if sys.platform == "win32":
            try:
                win_path = norm_path
                if not win_path.startswith("\\\\?\\") and len(win_path) >= 3 and win_path[1] == ":":
                    ext_path = "\\\\?\\" + win_path
                else:
                    ext_path = win_path

                subprocess.run(["cmd.exe", "/c", "rd", "/s", "/q", ext_path], capture_output=True, text=True, timeout=30)
                if not os.path.exists(norm_path):
                    return True
            except Exception:
                pass

        # 2. Fallback to Python shutil.rmtree with robust error handler
        try:
            if sys.version_info >= (3, 12):
                shutil.rmtree(norm_path, onexc=remove_readonly)
            else:
                shutil.rmtree(norm_path, onerror=remove_readonly)

            if not os.path.exists(norm_path):
                return True
        except Exception:
            pass

        time.sleep(delay)

    is_gone = not os.path.exists(norm_path)
    if not is_gone:
        console.print(f"[error]❌ Failed to remove directory after {retries} retries: {norm_path}[/error]")
    return is_gone

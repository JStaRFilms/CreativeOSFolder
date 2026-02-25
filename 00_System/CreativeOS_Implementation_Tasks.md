# CreativeOS Implementation Tasks
## Complete Task Breakdown from Deep Audit Report

**Created:** February 25, 2026  
**Status:** Ready for Execution  
**Note:** `00_System/Scripts/Link.txt` is preserved - contains original AI chat history

---

## Task Priority Overview

| Phase | Priority | Tasks | Estimated Time |
|-------|----------|-------|----------------|
| Phase 1 | P0 - Critical Security | 6 tasks | 2-3 hours |
| Phase 2 | P0 - Critical Fixes | 4 tasks | 1 hour |
| Phase 3 | P1 - Infrastructure | 5 tasks | 2 hours |
| Phase 4 | P1 - Code Quality | 4 tasks | 3-4 hours |
| Phase 5 | P1 - Modularization | 1 task | 4-6 hours |
| Phase 6 | P2 - Testing | 3 tasks | 4-6 hours |
| Phase 7 | P2 - Documentation | 4 tasks | 2 hours |

---

## Phase 1: P0 - Critical Security Fixes

### Task 1.1: Add Input Sanitization Module
**Priority:** P0 - CRITICAL  
**Location:** `00_System/Scripts/manage.py`  
**Issue:** SEC-001 - Path Traversal vulnerability

**Objective:**
Create a sanitization module to prevent path traversal attacks through `--client`, `--name`, and other user inputs.

**Implementation Details:**

1. Add a new function `sanitize_path_input()` at the top of `manage.py` (after imports):

```python
import re

def sanitize_path_input(value: str, max_length: int = 100) -> str:
    """
    Sanitize user input to prevent path traversal attacks.
    
    Removes:
    - Path separators (/, \)
    - Parent directory references (..)
    - Special characters that could be used for injection
    - Windows reserved names
    
    Args:
        value: The input string to sanitize
        max_length: Maximum allowed length (default 100)
    
    Returns:
        Sanitized string safe for use in paths
    
    Raises:
        ValueError: If input is empty after sanitization
    """
    if not value:
        raise ValueError("Input cannot be empty")
    
    # Windows reserved names
    reserved_names = {
        'CON', 'PRN', 'AUX', 'NUL',
        'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
        'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    }
    
    # Remove null bytes and control characters
    sanitized = re.sub(r'[\x00-\x1f\x7f]', '', value)
    
    # Remove path separators and parent directory references
    sanitized = re.sub(r'[<>:"/\\|?*]', '', sanitized)
    
    # Remove leading dots that could be path traversal
    sanitized = re.sub(r'^\.+', '', sanitized)
    
    # Collapse multiple spaces into one
    sanitized = re.sub(r'\s+', ' ', sanitized)
    
    # Trim whitespace
    sanitized = sanitized.strip()
    
    # Check for reserved names
    base_name = sanitized.upper().split('.')[0] if '.' in sanitized else sanitized.upper()
    if base_name in reserved_names:
        raise ValueError(f"'{value}' is a reserved name and cannot be used")
    
    # Check length
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length]
    
    if not sanitized:
        raise ValueError(f"Input '{value}' contains only invalid characters")
    
    return sanitized
```

2. Update `cmd_new()` function (around line 343):

```python
def cmd_new(args):
    # ADD: Sanitize project name
    try:
        project_name = sanitize_path_input(args.name)
    except ValueError as e:
        console.print(f"[error]❌ Invalid project name: {e}[/error]")
        return
    
    category = args.category.title()
    date_prefix = get_date_slug(args.date)
    safe_name = project_name.replace(" ", "_")
    slug = f"{date_prefix}_{safe_name}"
    
    # ... rest of function
    
    # ADD: Sanitize client if provided
    if args.client:
        try:
            args.client = sanitize_path_input(args.client)
        except ValueError as e:
            console.print(f"[error]❌ Invalid client name: {e}[/error]")
            return
```

3. Update `cmd_clone()` function (around line 654):

```python
def cmd_clone(args):
    # ADD: Sanitize project name if provided
    if args.name:
        try:
            args.name = sanitize_path_input(args.name)
        except ValueError as e:
            console.print(f"[error]❌ Invalid project name: {e}[/error]")
            return
    
    # ... rest of function
    
    # ADD: Sanitize client if provided (same as cmd_new)
```

**Verification:**
- Run `cos new "../../../Windows" -c Video` - should fail with error
- Run `cos new "Valid Project" -c Video` - should succeed
- Run `cos new "CON" -c Video` - should fail (reserved name)

---

### Task 1.2: Fix Git Clone Command Injection
**Priority:** P0 - CRITICAL  
**Location:** `00_System/Scripts/manage.py:706`  
**Issue:** SEC-002 - Command Injection via Git URL

**Objective:**
Prevent Git from interpreting URLs as flags by adding `--` separator and validating URL format.

**Implementation Details:**

1. Add URL validation function after `sanitize_path_input()`:

```python
import re
from urllib.parse import urlparse

def validate_git_url(url: str) -> str:
    """
    Validate and sanitize a Git repository URL.
    
    Accepts:
    - HTTPS URLs: https://github.com/user/repo.git
    - SSH URLs: git@github.com:user/repo.git
    - Git protocol: git://github.com/user/repo.git
    
    Rejects:
    - URLs starting with - (flag injection)
    - File:// URLs (local file access)
    - Invalid formats
    
    Args:
        url: The Git URL to validate
    
    Returns:
        The validated URL
    
    Raises:
        ValueError: If URL is invalid or potentially malicious
    """
    if not url:
        raise ValueError("Git URL cannot be empty")
    
    url = url.strip()
    
    # Reject URLs starting with dash (flag injection)
    if url.startswith('-'):
        raise ValueError("URL cannot start with '-' (potential flag injection)")
    
    # Reject file:// protocol (local file access)
    if url.lower().startswith('file://'):
        raise ValueError("file:// URLs are not allowed")
    
    # Validate HTTPS URLs
    if url.startswith('https://') or url.startswith('http://'):
        try:
            parsed = urlparse(url)
            if not parsed.netloc:
                raise ValueError("Invalid URL: missing host")
            return url
        except Exception as e:
            raise ValueError(f"Invalid URL format: {e}")
    
    # Validate SSH URLs (git@host:path)
    if url.startswith('git@'):
        if ':' not in url or '/' not in url:
            raise ValueError("Invalid SSH URL format. Expected: git@host:path/repo.git")
        return url
    
    # Validate git:// protocol
    if url.startswith('git://'):
        return url
    
    # If it looks like a simple path/repo, assume GitHub HTTPS
    if re.match(r'^[\w-]+/[\w.-]+$', url):
        return f"https://github.com/{url}"
    
    raise ValueError(
        f"Unrecognized URL format: {url}\n"
        "Supported formats:\n"
        "  - https://github.com/user/repo.git\n"
        "  - git@github.com:user/repo.git\n"
        "  - git://github.com/user/repo.git"
    )
```

2. Update `cmd_clone()` function (around line 704-706):

```python
def cmd_clone(args):
    """Clones a Git repo and adopts it into CreativeOS."""
    url = args.url
    
    # ADD: Validate URL
    try:
        url = validate_git_url(url)
    except ValueError as e:
        console.print(f"[error]❌ {e}[/error]")
        return
    
    # ... existing code ...
    
    # CHANGE: Add -- before URL in subprocess call
    try:
        with console.status("[bold cyan]Cloning...[/bold cyan]"):
            # OLD: subprocess.run(["git", "clone", url, target_dir], check=True)
            subprocess.run(["git", "clone", "--", url, target_dir], check=True)
    except Exception as e:
        console.print(f"[error]❌ Git Clone failed: {e}[/error]")
        return
```

**Verification:**
- Run `cos clone "--upload-pack=malicious"` - should fail with error
- Run `cos clone "https://github.com/user/repo.git"` - should succeed
- Run `cos clone "file:///etc/passwd"` - should fail

---

### Task 1.3: Fix PowerShell Command Injection in fix_metadata.py
**Priority:** P0 - CRITICAL  
**Location:** `00_System/Scripts/fix_metadata.py:152-184`  
**Issue:** SEC-003 - PowerShell injection via file paths

**Objective:**
Properly escape file paths before interpolating into PowerShell commands.

**Implementation Details:**

1. Replace the `set_file_times()` function (lines 72-280) with a safer version:

```python
def set_file_times(file_path: str, new_date: datetime) -> None:
    """
    Sets the creation and modification time of a file using PowerShell.
    
    Uses Base64-encoded command to prevent injection attacks.
    
    Args:
        file_path: Path to the file to modify
        new_date: The new timestamp to set
    
    Raises:
        subprocess.CalledProcessError: If PowerShell command fails
        Exception: For other errors
    """
    try:
        # Format for PowerShell: 'YYYY-MM-DD HH:MM:SS'
        date_str = new_date.strftime('%Y-%m-%d %H:%M:%S')
        
        # Build the PowerShell script
        ps_script = f'''
$file = Get-Item -LiteralPath {escape_ps_string(file_path)}
$file.CreationTime = Get-Date '{date_str}'
$file.LastWriteTime = Get-Date '{date_str}'
'''
        
        # Encode the script to avoid encoding issues
        encoded_script = base64.b64encode(ps_script.encode('utf-16-le')).decode('ascii')
        
        # Execute with encoded command
        subprocess.run(
            ["powershell", "-NoProfile", "-EncodedCommand", encoded_script],
            check=True,
            capture_output=True,
            text=True
        )
        
    except subprocess.CalledProcessError as e:
        print(f"Error updating metadata for {os.path.basename(file_path)}: {e.stderr}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")


def escape_ps_string(s: str) -> str:
    """
    Escape a string for safe use in PowerShell single-quoted strings.
    
    In PowerShell single-quoted strings, only single quotes need escaping
    (by doubling them).
    
    Args:
        s: The string to escape
    
    Returns:
        The escaped string wrapped in single quotes
    """
    # Escape single quotes by doubling them
    escaped = s.replace("'", "''")
    return f"'{escaped}'"
```

2. Add import at top of file:

```python
import base64
from datetime import datetime
```

**Verification:**
- Test with file named `test"; Write-Host "pwned"; ".txt`
- Test with file named `test$file.txt`
- Test with file named `test`nfile.txt`

---

### Task 1.4: Add Path Validation for find_meta_in_cwd
**Priority:** P0 - HIGH  
**Location:** `00_System/Scripts/manage.py:96-106`  
**Issue:** SEC-006 - Arbitrary file read via upward traversal

**Objective:**
Validate that found metadata files are within expected project boundaries.

**Implementation Details:**

1. Update `find_meta_in_cwd()` function:

```python
def find_meta_in_cwd():
    """
    Search upward from current directory for .project_meta.json.
    
    Performs a 3-level upward search for project metadata.
    Validates that the metadata file is within expected bounds.
    
    Returns:
        tuple: (metadata_dict, project_root) or (None, None) if not found
    """
    current = os.getcwd()
    original_cwd = current
    
    for _ in range(3):
        meta_path = os.path.join(current, ".project_meta.json")
        
        if os.path.exists(meta_path):
            try:
                with open(meta_path, "r", encoding="utf-8-sig") as f:
                    meta = json.load(f)
                
                # ADD: Validate metadata structure
                required_fields = {"name", "slug", "type", "created"}
                if not required_fields.issubset(meta.keys()):
                    console.print(f"[warning]⚠️  Found metadata but missing required fields: {meta_path}[/warning]")
                    return None, None
                
                # ADD: Validate path is within PROJECTS_PATH
                try:
                    # Resolve to absolute path to handle symlinks, etc.
                    abs_current = os.path.realpath(current)
                    abs_projects = os.path.realpath(PROJECTS_PATH)
                    
                    if not abs_current.startswith(abs_projects):
                        console.print(f"[warning]⚠️  Found metadata outside projects path: {meta_path}[/warning]")
                        return None, None
                except Exception:
                    pass  # If path validation fails, continue anyway
                
                return meta, current
                
            except json.JSONDecodeError as e:
                console.print(f"[warning]⚠️  Invalid JSON in metadata: {meta_path}[/warning]")
                return None, None
            except IOError as e:
                console.print(f"[warning]⚠️  Cannot read metadata: {e}[/warning]")
                return None, None
        
        # Move up one directory
        parent = os.path.dirname(current)
        
        # Check if we've reached the root
        if parent == current:
            break
            
        current = parent
    
    return None, None
```

**Verification:**
- Test from within a valid project - should find metadata
- Test from outside PROJECTS_PATH - should return None
- Test with corrupted .project_meta.json - should handle gracefully

---

### Task 1.5: Add Input Validation for All CLI Arguments
**Priority:** P0 - HIGH  
**Location:** `00_System/Scripts/manage.py`  
**Issue:** SEC-005 - No input validation for project names

**Objective:**
Add comprehensive validation for all user inputs at the CLI argument level.

**Implementation Details:**

1. Create a custom argument validation function:

```python
def validate_project_name(value: str) -> str:
    """Argparse validator for project names."""
    try:
        return sanitize_path_input(value, max_length=100)
    except ValueError as e:
        raise argparse.ArgumentTypeError(str(e))


def validate_client_name(value: str) -> str:
    """Argparse validator for client names."""
    try:
        return sanitize_path_input(value, max_length=50)
    except ValueError as e:
        raise argparse.ArgumentTypeError(str(e))


def validate_date(value: str) -> str:
    """Argparse validator for date strings."""
    try:
        # Validate date format
        datetime.datetime.strptime(value, "%Y-%m-%d")
        return value
    except ValueError:
        raise argparse.ArgumentTypeError(
            f"Invalid date format: '{value}'. Use YYYY-MM-DD format."
        )
```

2. Update argument parsers in `main()` function:

```python
# --- NEW ---
p_new = subparsers.add_parser("new", help="Spawn a new project")
p_new.add_argument("name", type=validate_project_name, 
                   help="Project name (alphanumeric, spaces, hyphens, underscores)")
p_new.add_argument("-c", "--category", type=str, default="Video",
                   choices=["Video", "Code", "Web", "AI", "Music", "Audio"])
p_new.add_argument("-s", "--simple", action="store_true")
p_new.add_argument("-d", "--date", type=validate_date)
p_new.add_argument("--client", type=validate_client_name)
p_new.add_argument("-g", "--git", action="store_true")

# --- CLONE ---
p_clone = subparsers.add_parser("clone", help="Clone a repo into CreativeOS")
p_clone.add_argument("url", type=str, help="Git repository URL")
p_clone.add_argument("-n", "--name", type=validate_project_name)
p_clone.add_argument("-c", "--category", type=str, default="Video")
p_clone.add_argument("-d", "--date", type=validate_date)
p_clone.add_argument("--client", type=validate_client_name)
```

**Verification:**
- Run `cos new "test/path" -c Video` - should fail
- Run `cos new "test project" -d "2024-13-01"` - should fail (invalid date)
- Run `cos new "test project" -d "2024-01-15"` - should succeed

---

### Task 1.6: Add Secure File Permissions
**Priority:** P0 - MEDIUM  
**Location:** `00_System/Scripts/manage.py`  
**Issue:** SEC-009 - Insecure file permissions

**Objective:**
Set explicit permissions for sensitive files.

**Implementation Details:**

1. Add permission constants at top of file:

```python
import stat

# File permissions
CONFIG_PERMISSIONS = stat.S_IRUSR | stat.S_IWUSR  # 0o600 - owner read/write only
DIR_PERMISSIONS = stat.S_IRWXU | stat.S_IRWXG | stat.S_IROTH | stat.S_IXOTH  # 0o750
```

2. Update `cmd_new()` to set permissions:

```python
# After creating .project_meta.json
meta_path = os.path.join(target_dir, ".project_meta.json")
with open(meta_path, "w") as f:
    json.dump(meta, f, indent=4)

# ADD: Set restrictive permissions on metadata file
try:
    os.chmod(meta_path, CONFIG_PERMISSIONS)
except OSError:
    pass  # Windows may not support Unix permissions
```

---

## Phase 2: P0 - Critical Fixes

### Task 2.1: Fix Performance Bottleneck in get_smart_date
**Priority:** P0 - HIGH  
**Location:** `00_System/Scripts/manage.py:108-117`  
**Issue:** LOG-001 - Unpruned directory walk

**Objective:**
Add `EXCLUDED_DIRS` pruning to prevent freezing on large projects.

**Implementation Details:**

1. Update `get_smart_date()` function:

```python
def get_smart_date(path: str) -> float:
    """
    Calculate the median timestamp of files in a directory.
    
    Uses smart pruning to skip heavy directories like node_modules, .git, etc.
    
    Args:
        path: Path to file or directory
    
    Returns:
        Median timestamp as float, or file mtime if single file
    """
    if os.path.isfile(path):
        return os.path.getmtime(path)
    
    timestamps = []
    
    for root, dirs, files in os.walk(path, topdown=True):
        # ADD: Prune excluded directories in-place (massive speedup)
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
```

**Verification:**
- Run `cos init` in a project with large node_modules - should complete quickly
- Compare timing before and after fix

---

### Task 2.2: Fix Duplicate Code in get_date_slug
**Priority:** P0 - LOW  
**Location:** `00_System/Scripts/manage.py:71-74`  
**Issue:** LOG-002 - Duplicate check

**Implementation Details:**

1. Fix the duplicate line:

```python
def get_date_slug(override_date: str = None) -> str:
    """
    Generate a date slug for project naming.
    
    Args:
        override_date: Optional date string in YYYY-MM-DD format
    
    Returns:
        Date string in YYYY-MM-DD format
    """
    if override_date:
        return override_date
    return datetime.datetime.now().strftime("%Y-%m-%d")
```

---

### Task 2.3: Fix cos.bat Portability
**Priority:** P0 - HIGH  
**Location:** `00_System/Scripts/cos.bat`  
**Issue:** LOG-006 - Hardcoded absolute path

**Implementation Details:**

1. Replace the entire contents of `cos.bat`:

```batch
@echo off
REM CreativeOS CLI Entry Point
REM Uses %~dp0 to get the script's directory for portability

python "%~dp0manage.py" %*
```

**Verification:**
- Move CreativeOS to a different drive/location
- Run `cos` command - should work from any location

---

### Task 2.4: Delete Dead Code
**Priority:** P0 - MEDIUM  
**Location:** `00_System/Scripts/`  
**Issue:** Dead code cleanup

**Implementation Details:**

1. Delete the duplicate file:
   - Delete: `00_System/Scripts/manage (1).py`

2. Archive migration scripts:
   - Create: `00_System/Scripts/_archive/migrations/`
   - Move all `migrate_*.ps1` and `retrofit_*.ps1` files there

**Files to Move:**
- `migrate_assets.ps1`
- `migrate_creative_os.ps1`
- `migrate_projects.ps1`
- `migration_edit_script.ps1`
- `retrofit_projects.ps1`
- `MigrateThumbnails.ps1`
- `delete_trickplay_files.ps1`

**Files to Keep in Scripts/:**
- `manage.py` (main CLI)
- `cos.bat` (entry point)
- `fix_metadata.py` (utility - document purpose)
- `Link.txt` (original AI chat history - PRESERVE)

---

## Phase 3: P1 - Infrastructure

### Task 3.1: Create requirements.txt
**Priority:** P1 - HIGH  
**Location:** `00_System/requirements.txt` (new file)

**Implementation Details:**

```txt
# CreativeOS Dependencies
# Install with: pip install -r requirements.txt

# Core dependencies
rich>=13.0.0,<14.0.0

# Note: tqdm is mentioned in docs but not actually used in the codebase
# If you plan to use it in the future, uncomment the line below:
# tqdm>=4.65.0
```

---

### Task 3.2: Create pyproject.toml
**Priority:** P1 - HIGH  
**Location:** `pyproject.toml` (new file at root)

**Implementation Details:**

```toml
[build-system]
requires = ["setuptools>=61.0", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "creativeos"
version = "2.1.0"
description = "The Central Nervous System for Creative Workflows"
readme = "README.md"
license = {text = "MIT"}
requires-python = ">=3.10"
authors = [
    {name = "J Star", email = "your-email@example.com"}
]
keywords = ["cli", "project-management", "creative", "workflow"]
classifiers = [
    "Development Status :: 4 - Beta",
    "Environment :: Console",
    "Intended Audience :: End Users/Desktop",
    "License :: OSI Approved :: MIT License",
    "Operating System :: Microsoft :: Windows",
    "Programming Language :: Python :: 3",
    "Programming Language :: Python :: 3.10",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
    "Topic :: Utilities",
]

dependencies = [
    "rich>=13.0.0,<14.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "pytest-cov>=4.0.0",
    "mypy>=1.0.0",
    "ruff>=0.1.0",
]

[project.scripts]
cos = "cos.cli:main"

[project.urls]
Homepage = "https://github.com/yourusername/creativeos"
Documentation = "https://github.com/yourusername/creativeos#readme"
Repository = "https://github.com/yourusername/creativeos.git"

[tool.setuptools.packages.find]
where = ["00_System/Scripts"]

[tool.ruff]
line-length = 100
target-version = "py310"

[tool.ruff.lint]
select = ["E", "F", "W", "I", "N", "UP", "B", "C4"]
ignore = ["E501"]  # Line too long (handled by formatter)

[tool.mypy]
python_version = "3.10"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
disallow_incomplete_defs = true

[tool.pytest.ini_options]
testpaths = ["00_System/Scripts/tests"]
python_files = ["test_*.py"]
python_functions = ["test_*"]
addopts = "-v --cov=cos --cov-report=term-missing"
```

---

### Task 3.3: Create .python-version File
**Priority:** P1 - LOW  
**Location:** `.python-version` (new file at root)

**Implementation Details:**

```
3.10
```

---

### Task 3.4: Update .gitignore
**Priority:** P1 - MEDIUM  
**Location:** `.gitignore`

**Implementation Details:**

Add Python-specific entries to existing `.gitignore`:

```gitignore
# --- IGNORE EVERYTHING ---
# Ignore everything in the root by default to keep the repo clean
*

# --- ALLOWLIST (Resurrect these specific items) ---
!00_System/
!README.md
!USER MANUAL.md
!install_cos.py
!.gitignore
!pyproject.toml
!requirements.txt
!.python-version

# --- GLOBAL WRAPPERS (Ignore these everywhere, even in allowed folders) ---
.DS_Store
Thumbs.db
*.log
*.tmp
*.bak
__pycache__/
.tmp.driveupload/

# --- Python ---
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
.mypy_cache/
.ruff_cache/
.pytest_cache/
htmlcov/
.coverage

# --- Virtual Environments ---
.env
.venv
env/
venv/
ENV/

# --- IDE ---
.vscode/
.idea/
*.swp
*.swo
```

---

### Task 3.5: Create Config Template
**Priority:** P1 - MEDIUM  
**Location:** `00_System/Config/config.template.json` (new file)

**Implementation Details:**

```json
{
    "_comment": "Copy this file to config.json and fill in your paths",
    
    "root_path": "C:\\CreativeOS",
    "projects_path": "C:\\CreativeOS\\01_Projects",
    "exports_path": "C:\\CreativeOS\\02_Exports",
    "templates_path": "C:\\CreativeOS\\00_System\\Templates",
    "vault_path": "C:\\CreativeOS\\03_Vault",
    
    "_downloads_comment": "Your browser's download folder",
    "downloads_path": "C:\\Users\\YOUR_USERNAME\\Downloads",
    
    "_shuttle_comment": "External drive for project transport (set to null if not using)",
    "shuttle_path": "D:\\CreativeOS_Shuttle",
    
    "_archive_comment": "Where completed projects are stored (set to null if not using)",
    "archive_path": "D:\\Archive",
    
    "version": "2.1.0"
}
```

---

## Phase 4: P1 - Code Quality

### Task 4.1: Add Type Hints to Core Functions
**Priority:** P1 - HIGH  
**Location:** `00_System/Scripts/manage.py`

**Implementation Details:**

Add type hints to all functions. Here are the key ones:

```python
from pathlib import Path
from typing import Optional, Dict, List, Tuple, Any

# Type aliases
JSONDict = Dict[str, Any]
FileFingerprint = Dict[str, float | int]
SyncState = Dict[str, Any]

def get_date_slug(override_date: Optional[str] = None) -> str: ...

def format_path(path: str) -> str: ...

def get_export_month_path() -> str: ...

def find_meta_in_cwd() -> Tuple[Optional[JSONDict], Optional[str]]: ...

def get_smart_date(path: str) -> float: ...

def load_sync_state() -> SyncState: ...

def save_sync_state(state: SyncState) -> None: ...

def get_file_fingerprint(filepath: str) -> Optional[FileFingerprint]: ...

def get_syncable_files(root_dir: str) -> Dict[str, Optional[FileFingerprint]]: ...

def sync_two_folders(
    dir_a: str, 
    dir_b: str, 
    prev_state: Optional[SyncState] = None
) -> Tuple[List[Dict[str, str]], SyncState]: ...

def copy_with_progress(src: str, dst: str) -> None: ...

def setup_git(project_path: str, category: str) -> None: ...

def sanitize_path_input(value: str, max_length: int = 100) -> str: ...

def validate_git_url(url: str) -> str: ...
```

---

### Task 4.2: Add Docstrings to All Functions
**Priority:** P1 - MEDIUM  
**Location:** `00_System/Scripts/manage.py`

**Implementation Details:**

Add Google-style docstrings to all functions:

```python
def cmd_new(args: argparse.Namespace) -> None:
    """
    Create a new project with the specified name and options.
    
    This command creates a new project directory structure based on the
    selected template, initializes metadata, and optionally sets up Git.
    
    Args:
        args: Parsed command-line arguments containing:
            - name: Project name (required)
            - category: Project category (default: "Video")
            - simple: Use simple template flag
            - date: Override creation date
            - client: Client name for grouping
            - git: Initialize Git repository flag
    
    Side Effects:
        - Creates project directory structure
        - Creates .project_meta.json file
        - Creates 00_Notes/Idea.md file
        - Optionally initializes Git repository
    
    Example:
        >>> args = argparse.Namespace(name="My Project", category="Video", ...)
        >>> cmd_new(args)
        # Creates: 01_Projects/Video/2026-02-25_My_Project/
    """
```

---

### Task 4.3: Add Central Error Handler
**Priority:** P1 - MEDIUM  
**Location:** `00_System/Scripts/manage.py`

**Implementation Details:**

Add a custom exception handler for beautiful error display:

```python
import sys
import traceback

def handle_exception(exc_type, exc_value, exc_traceback):
    """
    Custom exception handler for beautiful error display via Rich.
    """
    if issubclass(exc_type, KeyboardInterrupt):
        console.print("\n[yellow]Operation cancelled by user.[/yellow]")
        sys.exit(1)
    
    console.print(Panel(
        f"[bold red]An unexpected error occurred:[/bold red]\n\n"
        f"[dim]{exc_type.__name__}:[/dim] {exc_value}\n\n"
        f"[dim]Please report this issue if it persists.[/dim]",
        title="❌ Error",
        border_style="red"
    ))
    
    # Print full traceback to a log file
    log_path = os.path.join(SCRIPT_DIR, "..", "Config", "error.log")
    with open(log_path, "a") as f:
        f.write(f"\n{'='*50}\n")
        f.write(f"Time: {datetime.datetime.now().isoformat()}\n")
        traceback.print_exception(exc_type, exc_value, exc_traceback, file=f)
    
    console.print(f"[dim]Full error logged to: {log_path}[/dim]")
    sys.exit(1)


# In main():
def main():
    # Set custom exception handler
    sys.excepthook = handle_exception
    
    # ... rest of main()
```

---

### Task 4.4: Add Logging Framework
**Priority:** P1 - LOW  
**Location:** `00_System/Scripts/manage.py`

**Implementation Details:**

Add Python logging for debugging:

```python
import logging

# Setup logging
LOG_PATH = os.path.join(SCRIPT_DIR, "..", "Config", "creativeos.log")

logging.basicConfig(
    filename=LOG_PATH,
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

logger = logging.getLogger('creativeos')

# Use in functions:
def cmd_new(args):
    logger.info(f"Creating new project: {args.name}")
    # ...
    logger.debug(f"Project created at: {target_dir}")
```

---

## Phase 5: P1 - Modularization

### Task 5.1: Refactor manage.py into Package Structure
**Priority:** P1 - HIGH  
**Location:** `00_System/Scripts/cos/` (new package)

**Implementation Details:**

Create the following package structure:

```
00_System/Scripts/
├── cos.bat                     # Entry point (updated)
├── cos/                        # New package directory
│   ├── __init__.py             # Package init, version info
│   ├── cli.py                  # Argparse router (~50 lines)
│   ├── config.py               # Config loading (~80 lines)
│   ├── console.py              # Rich console setup (~30 lines)
│   ├── security.py             # Input validation, sanitization (~100 lines)
│   ├── file_utils.py           # File operations (~150 lines)
│   ├── git_utils.py            # Git operations (~100 lines)
│   └── commands/               # Command implementations
│       ├── __init__.py
│       ├── new.py              # cmd_new (~120 lines)
│       ├── clone.py            # cmd_clone (~100 lines)
│       ├── init.py             # cmd_init (~80 lines)
│       ├── sync.py             # cmd_sync (~150 lines)
│       ├── export.py           # cmd_export (~40 lines)
│       ├── thumbs.py           # cmd_thumbs (~60 lines)
│       ├── clean.py            # cmd_clean (~80 lines)
│       ├── sort_exports.py     # cmd_sort_exports (~60 lines)
│       ├── travel.py           # cmd_travel (~80 lines)
│       └── resurrect.py        # cmd_resurrect (~100 lines)
├── manage.py                   # Keep for backwards compatibility
└── tests/                      # Test directory
    ├── __init__.py
    ├── conftest.py
    └── ...
```

**This is a large task - break into subtasks:**

1. Create package directory structure
2. Create `__init__.py` with version and exports
3. Create `console.py` with Rich setup
4. Create `config.py` with config loading
5. Create `security.py` with validation functions
6. Create `file_utils.py` with file operations
7. Create `git_utils.py` with Git operations
8. Create each command module
9. Create `cli.py` as main router
10. Update `cos.bat` to use new package
11. Keep `manage.py` as backwards-compatible wrapper

---

## Phase 6: P2 - Testing

### Task 6.1: Create Test Infrastructure
**Priority:** P2 - HIGH  
**Location:** `00_System/Scripts/tests/`

**Implementation Details:**

1. Create `conftest.py`:

```python
import pytest
import tempfile
import shutil
import json
import os

@pytest.fixture
def temp_projects_dir():
    """Create a temporary directory for test projects."""
    with tempfile.TemporaryDirectory() as tmpdir:
        projects_path = os.path.join(tmpdir, "01_Projects")
        os.makedirs(projects_path)
        yield projects_path

@pytest.fixture
def temp_config(temp_projects_dir, tmp_path):
    """Create a temporary config file for testing."""
    config = {
        "root_path": str(tmp_path),
        "projects_path": temp_projects_dir,
        "exports_path": str(tmp_path / "02_Exports"),
        "templates_path": str(tmp_path / "00_System" / "Templates"),
        "vault_path": str(tmp_path / "03_Vault"),
        "version": "2.1.0"
    }
    
    config_path = tmp_path / "config.json"
    with open(config_path, "w") as f:
        json.dump(config, f)
    
    yield config_path

@pytest.fixture
def sample_project(temp_projects_dir):
    """Create a sample project for testing."""
    project_path = os.path.join(temp_projects_dir, "2026-02-25_Test_Project")
    os.makedirs(project_path)
    
    meta = {
        "name": "Test Project",
        "slug": "2026-02-25_Test_Project",
        "type": "Video",
        "created": "2026-02-25",
        "client": "None",
        "template": "video_project",
        "root": project_path
    }
    
    with open(os.path.join(project_path, ".project_meta.json"), "w") as f:
        json.dump(meta, f)
    
    yield project_path
```

---

### Task 6.2: Create Unit Tests
**Priority:** P2 - HIGH  
**Location:** `00_System/Scripts/tests/`

**Implementation Details:**

Create test files for each module:

```python
# test_security.py

import pytest
from cos.security import sanitize_path_input, validate_git_url

class TestSanitizePathInput:
    def test_valid_name(self):
        assert sanitize_path_input("My Project") == "My Project"
    
    def test_removes_path_separators(self):
        assert "/" not in sanitize_path_input("test/path")
        assert "\\" not in sanitize_path_input("test\\path")
    
    def test_removes_parent_reference(self):
        result = sanitize_path_input("../../../etc/passwd")
        assert ".." not in result
        assert "/" not in result
    
    def test_reserved_names_rejected(self):
        with pytest.raises(ValueError, match="reserved"):
            sanitize_path_input("CON")
        with pytest.raises(ValueError, match="reserved"):
            sanitize_path_input("PRN")
    
    def test_empty_after_sanitization(self):
        with pytest.raises(ValueError, match="invalid characters"):
            sanitize_path_input("///")
    
    def test_max_length(self):
        long_name = "a" * 200
        result = sanitize_path_input(long_name, max_length=100)
        assert len(result) == 100


class TestValidateGitUrl:
    def test_https_url(self):
        url = "https://github.com/user/repo.git"
        assert validate_git_url(url) == url
    
    def test_ssh_url(self):
        url = "git@github.com:user/repo.git"
        assert validate_git_url(url) == url
    
    def test_rejects_flag_injection(self):
        with pytest.raises(ValueError, match="flag injection"):
            validate_git_url("--upload-pack=malicious")
    
    def test_rejects_file_protocol(self):
        with pytest.raises(ValueError, match="not allowed"):
            validate_git_url("file:///etc/passwd")
    
    def test_shortform_expansion(self):
        result = validate_git_url("user/repo")
        assert result == "https://github.com/user/repo"
```

```python
# test_file_utils.py

import pytest
import os
import time
from cos.file_utils import get_smart_date, get_file_fingerprint

class TestGetSmartDate:
    def test_file_returns_mtime(self, tmp_path):
        test_file = tmp_path / "test.txt"
        test_file.write_text("content")
        expected = os.path.getmtime(test_file)
        result = get_smart_date(str(test_file))
        assert abs(result - expected) < 1.0
    
    def test_empty_directory(self, tmp_path):
        result = get_smart_date(str(tmp_path))
        assert result == os.path.getmtime(tmp_path)
    
    def test_skips_excluded_dirs(self, tmp_path):
        # Create node_modules with many files
        node_modules = tmp_path / "node_modules"
        node_modules.mkdir()
        for i in range(100):
            (node_modules / f"file{i}.js").write_text("content")
        
        # Create one file in root
        (tmp_path / "important.txt").write_text("important")
        
        start = time.time()
        result = get_smart_date(str(tmp_path))
        elapsed = time.time() - start
        
        # Should complete quickly (< 1 second) despite many files
        assert elapsed < 1.0
```

---

### Task 6.3: Create Integration Tests
**Priority:** P2 - MEDIUM  
**Location:** `00_System/Scripts/tests/integration/`

**Implementation Details:**

```python
# test_commands.py

import pytest
import os
import json
from cos.commands.new import cmd_new
from cos.commands.init import cmd_init

class TestCmdNew:
    def test_creates_project_directory(self, temp_config, temp_projects_dir):
        args = type('Args', (), {
            'name': 'Test Project',
            'category': 'Video',
            'simple': False,
            'date': None,
            'client': None,
            'git': False
        })()
        
        cmd_new(args)
        
        # Check project was created
        project_path = os.path.join(temp_projects_dir, "Video")
        assert os.path.exists(project_path)
        
        # Find the created project
        projects = os.listdir(project_path)
        assert any("Test_Project" in p for p in projects)
    
    def test_creates_metadata(self, temp_config, temp_projects_dir):
        args = type('Args', (), {
            'name': 'Meta Test',
            'category': 'Code',
            'simple': False,
            'date': '2026-01-15',
            'client': None,
            'git': False
        })()
        
        cmd_new(args)
        
        # Find and check metadata
        code_path = os.path.join(temp_projects_dir, "Code")
        for project in os.listdir(code_path):
            if "Meta_Test" in project:
                meta_path = os.path.join(code_path, project, ".project_meta.json")
                assert os.path.exists(meta_path)
                
                with open(meta_path) as f:
                    meta = json.load(f)
                
                assert meta["name"] == "Meta Test"
                assert meta["type"] == "Code"
                assert meta["created"] == "2026-01-15"
                break
```

---

## Phase 7: P2 - Documentation

### Task 7.1: Create CHANGELOG.md
**Priority:** P2 - MEDIUM  
**Location:** `CHANGELOG.md` (new file at root)

**Implementation Details:**

```markdown
# Changelog

All notable changes to CreativeOS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-02-25

### Added
- Input sanitization for all CLI arguments (security fix)
- URL validation for `cos clone` command
- Type hints throughout codebase
- Central error handler with beautiful error display
- Logging framework for debugging
- `pyproject.toml` for modern Python packaging
- `requirements.txt` with pinned dependencies
- Comprehensive test suite

### Fixed
- Path traversal vulnerability in `--client` and `--name` arguments
- Command injection vulnerability in `cos clone` URL handling
- PowerShell injection vulnerability in `fix_metadata.py`
- Performance bottleneck in `get_smart_date()` (now skips node_modules, .git, etc.)
- Portability issue in `cos.bat` (now uses relative paths)
- Duplicate code in `get_date_slug()`

### Changed
- Refactored monolithic `manage.py` into modular package structure
- Improved error messages with specific validation feedback
- Archived migration scripts to `_archive/migrations/`

### Security
- SEC-001: Fixed path traversal via CLI input
- SEC-002: Fixed command injection in git clone
- SEC-003: Fixed PowerShell injection in fix_metadata.py
- SEC-006: Added validation for metadata file discovery

## [2.0.0] - Previous Release

### Added
- Rich-based beautiful CLI interface
- Bidirectional sync with Obsidian vault
- Smart date detection for project adoption
- Context-aware command execution
- Multiple project templates (video, code, ai, audio, simple)
```

---

### Task 7.2: Create CONTRIBUTING.md
**Priority:** P2 - LOW  
**Location:** `CONTRIBUTING.md` (new file at root)

**Implementation Details:**

```markdown
# Contributing to CreativeOS

Thank you for your interest in contributing to CreativeOS!

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/creativeos.git
   cd creativeos
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv .venv
   .venv\Scripts\activate  # Windows
   source .venv/bin/activate  # Unix
   ```

3. **Install development dependencies**
   ```bash
   pip install -e ".[dev]"
   ```

4. **Run tests**
   ```bash
   pytest
   ```

## Code Style

- Follow PEP 8 conventions
- Use type hints for all functions
- Write docstrings for all public functions
- Keep functions under 50 lines
- Keep files under 200 lines

## Running Linters

```bash
ruff check .
mypy cos/
```

## Submitting Changes

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Run tests: `pytest`
4. Run linters: `ruff check . && mypy cos/`
5. Commit with conventional commits: `git commit -m "feat: add new feature"`
6. Push and create a pull request

## Code of Conduct

Be respectful, inclusive, and constructive.
```

---

### Task 7.3: Create SECURITY.md
**Priority:** P2 - MEDIUM  
**Location:** `SECURITY.md` (new file at root)

**Implementation Details:**

```markdown
# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.1.x   | :white_check_mark: |
| 2.0.x   | :x:                |
| < 2.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in CreativeOS, please report it by:

1. **Do not** open a public issue
2. Email security concerns to: [your-email@example.com]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

You will receive a response within 48 hours.

## Security Features

CreativeOS implements the following security measures:

- **Input Sanitization**: All CLI arguments are validated and sanitized
- **Path Validation**: File operations are constrained to configured paths
- **URL Validation**: Git URLs are validated before cloning
- **No Secrets in Code**: Configuration is externalized to `config.json`

## Known Security Considerations

- CreativeOS is designed for single-user local use
- No authentication/authorization built in
- File permissions follow system defaults (with optional hardening)
```

---

### Task 7.4: Create docs/ARCHITECTURE.md
**Priority:** P2 - LOW  
**Location:** `docs/ARCHITECTURE.md` (new file)

**Implementation Details:**

```markdown
# CreativeOS Architecture

## Overview

CreativeOS is a CLI-based project management system for creative professionals. It follows a hub-and-spoke architecture centered around a JSON configuration file.

## Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                      CreativeOS CLI                          │
│                      (cos/cli.py)                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌───────────┐ ┌───────────┐ ┌───────────┐
│  Config   │ │ Security  │ │ File Utils │
│  Loader   │ │ Validator │ │  Helpers   │
└───────────┘ └───────────┘ └───────────┘
        │             │             │
        └─────────────┼─────────────┘
                      ▼
        ┌─────────────────────────────┐
        │       Command Layer          │
        │  (commands/new, sync, etc.)  │
        └─────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌───────────┐ ┌───────────┐ ┌───────────┐
│ Projects  │ │   Vault   │ │  Archive  │
│   Path    │ │   Path    │ │   Path    │
└───────────┘ └───────────┘ └───────────┘
```

## Data Flow

### Project Creation (cos new)
1. User runs `cos new "Project Name" -c Video`
2. CLI parses arguments and validates input
3. Security layer sanitizes project name
4. Config loader determines target path
5. File utils create directory structure from template
6. Metadata file (.project_meta.json) is written
7. Optional: Git repository initialized

### Bidirectional Sync (cos sync)
1. User runs `cos sync`
2. System walks PROJECTS_PATH for .project_meta.json files
3. For each project, compares 00_Notes with vault copy
4. Uses mtime-first comparison for performance
5. Resolves conflicts by preferring newer file
6. Creates backup when pulling from vault

## Configuration

Configuration is stored in `00_System/Config/config.json`:

| Key | Purpose |
|-----|---------|
| root_path | Base directory for all CreativeOS data |
| projects_path | Where active projects are stored |
| exports_path | Where rendered exports are organized |
| templates_path | Project structure templates |
| vault_path | Obsidian vault for notes sync |
| shuttle_path | External drive for project transport |
| archive_path | Where completed projects are moved |

## Project Metadata

Each project contains `.project_meta.json`:

```json
{
    "name": "Human Readable Name",
    "slug": "2026-02-25_Human_Readable_Name",
    "type": "Video|Code|AI|Music",
    "created": "2026-02-25",
    "client": "Client Name or None",
    "template": "video_project",
    "root": "/path/to/project"
}
```

## Context Awareness

CreativeOS uses a "3-level up" rule to find project context:

1. Check current directory for .project_meta.json
2. If not found, check parent directory
3. Continue up to 3 levels
4. If still not found, use global context

This allows running commands from deep within a project structure.
```

---

## Summary

**Total Tasks: 27**

| Phase | Priority | Task Count |
|-------|----------|------------|
| Phase 1 | P0 - Critical Security | 6 |
| Phase 2 | P0 - Critical Fixes | 4 |
| Phase 3 | P1 - Infrastructure | 5 |
| Phase 4 | P1 - Code Quality | 4 |
| Phase 5 | P1 - Modularization | 1 (large) |
| Phase 6 | P2 - Testing | 3 |
| Phase 7 | P2 - Documentation | 4 |

**Estimated Total Time:** 16-24 hours

---

*Ready for execution. Awaiting your signal to begin.*

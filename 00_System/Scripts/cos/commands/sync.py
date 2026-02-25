"""Sync command."""

import os
import json
import argparse
import datetime
import shutil
import filecmp
from typing import Any, Tuple, List, Dict, Optional, Union

from rich.table import Table
from rich import box

from ..config import PROJECTS_PATH, VAULT_PATH, SYNC_STATE_PATH, EXCLUDED_DIRS, logger, SCRIPT_DIR
from ..console import console

FileFingerprint = Dict[str, Union[float, int]]
SyncState = Dict[str, Any]

def add_parser(subparsers: Any) -> None:
    subparsers.add_parser("sync", help="Sync Notes")

def load_sync_state() -> SyncState:
    """Load the sync state database for incremental syncs."""
    if os.path.exists(SYNC_STATE_PATH):
        try:
            with open(SYNC_STATE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}

def save_sync_state(state: SyncState) -> None:
    """Save the sync state database."""
    os.makedirs(os.path.dirname(SYNC_STATE_PATH), exist_ok=True)
    with open(SYNC_STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)

def get_file_fingerprint(filepath: str) -> Optional[FileFingerprint]:
    """Get a fast fingerprint for a file using mtime and size."""
    try:
        stat_info = os.stat(filepath)
        return {
            "mtime": stat_info.st_mtime,
            "size": stat_info.st_size
        }
    except OSError:
        return None

def get_syncable_files(root_dir: str) -> Dict[str, Optional[FileFingerprint]]:
    """Recursively find all .md and .pdf files, returning relative paths."""
    ALLOWED_EXTENSIONS = {".md", ".pdf"}
    files = {}
    for root, dirs, filenames in os.walk(root_dir, topdown=True):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        
        for f in filenames:
            ext = os.path.splitext(f)[1].lower()
            if ext in ALLOWED_EXTENSIONS:
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, root_dir)
                files[rel_path] = get_file_fingerprint(full_path)
    return files

def sync_two_folders(dir_a: str, dir_b: str, prev_state: Optional[SyncState] = None) -> Tuple[List[Dict[str, str]], SyncState]:
    """Bidirectional Sync: A (Project) <-> B (Vault). Recursively syncs .md and .pdf files."""
    if not os.path.exists(dir_a): os.makedirs(dir_a)
    if not os.path.exists(dir_b): os.makedirs(dir_b)

    files_a = get_syncable_files(dir_a)
    files_b = get_syncable_files(dir_b)
    all_files = set(files_a.keys()).union(set(files_b.keys()))
    logs = []
    new_state = {}
    
    for rel_path in all_files:
        path_a = os.path.join(dir_a, rel_path)
        path_b = os.path.join(dir_b, rel_path)
        
        fp_a = files_a.get(rel_path)
        fp_b = files_b.get(rel_path)

        # Case 1: New in A
        if fp_a and not fp_b:
            try:
                os.makedirs(os.path.dirname(path_b), exist_ok=True)
                shutil.copy2(path_a, path_b)
                logs.append({"type": "push", "file": rel_path, "msg": "Pushed to Vault"})
                new_state[rel_path] = fp_a
            except Exception as e: logs.append({"type": "error", "file": rel_path, "msg": str(e)})

        # Case 2: New in B
        elif fp_b and not fp_a:
            try:
                os.makedirs(os.path.dirname(path_a), exist_ok=True)
                shutil.copy2(path_b, path_a)
                logs.append({"type": "pull", "file": rel_path, "msg": "Pulled from Vault"})
                new_state[rel_path] = fp_b
            except Exception as e: logs.append({"type": "error", "file": rel_path, "msg": str(e)})

        # Case 3: File exists in both
        else:
            if fp_a and fp_b:
                if (fp_a["mtime"] == fp_b["mtime"] and fp_a["size"] == fp_b["size"]):
                    new_state[rel_path] = fp_a
                    continue
                
                if prev_state:
                    prev_fp = prev_state.get(rel_path)
                    if prev_fp:
                        if (fp_a["mtime"] == prev_fp["mtime"] and fp_a["size"] == prev_fp["size"] and
                            fp_b["mtime"] == prev_fp["mtime"] and fp_b["size"] == prev_fp["size"]):
                            new_state[rel_path] = prev_fp
                            continue
                
                try:
                    if fp_a["size"] != fp_b["size"]:
                        content_differs = True
                    elif fp_a["mtime"] == fp_b["mtime"]:
                        content_differs = False
                    else:
                        content_differs = not filecmp.cmp(path_a, path_b, shallow=False)
                    
                    if content_differs:
                        mtime_a = fp_a["mtime"]
                        mtime_b = fp_b["mtime"]
                        
                        if mtime_a > mtime_b:
                            shutil.copy2(path_a, path_b)
                            logs.append({"type": "update_vault", "file": rel_path, "msg": "Updated Vault"})
                            new_state[rel_path] = get_file_fingerprint(path_b)
                        elif mtime_b > mtime_a:
                            shutil.copy2(path_a, path_a + ".bak")
                            shutil.copy2(path_b, path_a)
                            logs.append({"type": "update_project", "file": rel_path, "msg": "Updated Project (Backup made)"})
                            new_state[rel_path] = get_file_fingerprint(path_a)
                        else:
                            shutil.copy2(path_a, path_b)
                            logs.append({"type": "conflict", "file": rel_path, "msg": "Content mismatch. Forced Push."})
                            new_state[rel_path] = get_file_fingerprint(path_b)
                    else:
                        new_state[rel_path] = fp_a
                except Exception as e: logs.append({"type": "error", "file": rel_path, "msg": str(e)})
    
    return logs, new_state

def cmd_sync(args: argparse.Namespace) -> None:
    """Sync Notes between Projects and Obsidian Vault."""
    logger.info("Starting sync operation")
    console.rule("[bold purple]Syncing CreativeOS Brain")
    vault_projects_dir = os.path.join(VAULT_PATH, "01_Active_Projects")
    if not os.path.exists(vault_projects_dir): os.makedirs(vault_projects_dir)

    changes_table = Table(show_header=True, header_style="bold magenta", box=box.SIMPLE)
    changes_table.add_column("Project", style="cyan")
    changes_table.add_column("Action", style="white")
    changes_table.add_column("File", style="dim")

    total_changes = 0
    projects_synced = 0
    
    prev_sync_state = load_sync_state()
    new_sync_state = {}
    
    with console.status("[bold cyan]Syncing Notes...[/bold cyan]"):
        for root, dirs, files in os.walk(PROJECTS_PATH, topdown=True):
            dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
            
            if ".project_meta.json" in files:
                meta_path = os.path.join(root, ".project_meta.json")
                try:
                    with open(meta_path, "r", encoding="utf-8-sig") as f: meta = json.load(f)
                except: continue
                
                project_name = meta.get("slug", "Unknown")
                notes_project = os.path.join(root, "00_Notes")
                notes_vault = os.path.join(vault_projects_dir, project_name)
                
                project_prev_state = prev_sync_state.get("projects", {}).get(project_name, {}).get("files", {})

                logs, project_state = sync_two_folders(notes_project, notes_vault, project_prev_state)
                
                if project_state:
                    if "projects" not in new_sync_state:
                        new_sync_state["projects"] = {}
                    new_sync_state["projects"][project_name] = {
                        "files": project_state,
                        "last_sync": datetime.datetime.now().isoformat()
                    }
                
                projects_synced += 1
                
                for log in logs:
                    symbol = "✅"
                    if log["type"] == "push": symbol = "→ [green]Push[/green]"
                    elif log["type"] == "pull": symbol = "← [blue]Pull[/blue]"
                    elif log["type"] == "error": symbol = "❌ [red]Error[/red]"
                    elif log["type"] == "conflict": symbol = "⚠️ [yellow]Conflict[/yellow]"
                    
                    changes_table.add_row(project_name, symbol, log["file"])
                    total_changes += 1

    new_sync_state["last_full_sync"] = datetime.datetime.now().isoformat()
    save_sync_state(new_sync_state)

    if total_changes == 0:
        console.print(f"[success]✅ Everything is up to date. ({projects_synced} projects scanned)[/success]")
    else:
        console.print(changes_table)
        console.print(f"[success]✨ Sync Complete. {total_changes} operations across {projects_synced} projects.[/success]")

    logger.info(f"Sync complete: {total_changes} operations across {projects_synced} projects")

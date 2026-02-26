"""Resurrect command."""

import os
import argparse
import json
from typing import Any

from rich.panel import Panel
from rich.prompt import IntPrompt

from ..console import console
from ..config import PROJECTS_PATH, ARCHIVE_PATH
from ..file_utils import robust_rmtree, copy_with_progress

def add_parser(subparsers: Any) -> None:
    from ..help_formatter import RichHelpAction

    p_res = subparsers.add_parser(
        "resurrect",
        help="Restore an archived project to the active Projects tree",
        description="""\
Search the Archive for a project matching the given name (or partial
name) and move it back into the active Projects tree.

The destination category folder is determined automatically from the
project's .project_meta.json.  If multiple projects match you will be
prompted to choose.

The project is MOVED — it is removed from the archive after a
successful copy.\
""",
        epilog="""\
Examples:
  cos resurrect my-film        Search archive for "my-film" and restore it
  cos resurrect "Old Brand"    Partial/fuzzy name matching supported\
""",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        add_help=False,
    )
    p_res.add_argument(
        "name",
        type=str,
        help="Project name (or partial name) to search for in the Archive.",
    )
    p_res.add_argument(
        "-h", "--help",
        action=RichHelpAction,
        help="Show this help message and exit.",
    )

def cmd_resurrect(args: argparse.Namespace) -> None:
    """Restore an archived project back to the Active Projects structure."""
    search_term = args.name.lower()
    console.print(f"🔎 Searching Archive for: '[cyan]{args.name}[/cyan]'...")
    
    if not os.path.exists(ARCHIVE_PATH):
        console.print(f"[error]Error: Archive path not found: {ARCHIVE_PATH}[/error]")
        return

    matches = []
    with console.status("Scanning Archive..."):
        for root, dirs, files in os.walk(ARCHIVE_PATH):
            for d in dirs:
                if search_term in d.lower():
                    matches.append(os.path.join(root, d))
            if root.count(os.sep) - ARCHIVE_PATH.count(os.sep) > 1:
                del dirs[:]

    if not matches:
        console.print("[warning]No matching projects found in Archive.[/warning]")
        return

    selected_path = matches[0]
    if len(matches) > 1:
        console.print("[bold]Multiple matches found:[/bold]")
        for i, m in enumerate(matches):
            console.print(f"   [green]{i+1}.[/green] {m}")
        
        choice = IntPrompt.ask("Select project number", choices=[str(i+1) for i in range(len(matches))])
        selected_path = matches[int(choice) - 1]

    project_name = os.path.basename(selected_path)
    console.print(f"✨ Resurrecting: [bold]{project_name}[/bold]")

    category = "Video"
    meta_path = os.path.join(selected_path, ".project_meta.json")
    
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8-sig") as f:
                meta = json.load(f)
                category = meta.get("type", "Video")
                if meta.get("client") and meta.get("client") != "None":
                    dest_root = os.path.join(PROJECTS_PATH, "Clients", meta["client"])
                else:
                    if category.lower() in ["web", "code"]: dest_cat = "Code"
                    elif category.lower() in ["music", "audio"]: dest_cat = "Music"
                    elif category.lower() == "ai": dest_cat = "AI"
                    else: dest_cat = "Video"
                    dest_root = os.path.join(PROJECTS_PATH, dest_cat)
        except:
            dest_root = os.path.join(PROJECTS_PATH, "Video")
    else:
        dest_root = os.path.join(PROJECTS_PATH, "Video")

    if not os.path.exists(dest_root): os.makedirs(dest_root)
    final_dest = os.path.join(dest_root, project_name)

    if os.path.exists(final_dest):
        console.print(f"[warning]Warning: Project already exists in Active Projects: {final_dest}[/warning]")
        return

    try:
        copy_with_progress(selected_path, final_dest)
        
        console.print("removing from archive...")
        if robust_rmtree(selected_path):
            console.print(Panel(f"Project moved to:\n[path]{final_dest}[/path]", title="✨ LIVE!", style="success"))
            os.startfile(final_dest)
        else:
             console.print(f"[warning]❌ Could not remove from archive. Copied safely to Active.[/warning]")
    except Exception as e:
        console.print(f"[error]❌ An unexpected error occurred: {e}[/error]")

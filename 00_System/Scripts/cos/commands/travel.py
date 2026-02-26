"""Travel command."""

import os
import argparse
import datetime
from typing import Any

from rich.panel import Panel
from rich.prompt import Confirm

from ..console import console
from ..config import PROJECTS_PATH, SHUTTLE_PATH
from ..file_utils import find_meta_in_cwd, format_path, copy_with_progress

def add_parser(subparsers: Any) -> None:
    from ..help_formatter import RichHelpAction

    p_travel = subparsers.add_parser(
        "travel",
        help="Copy the active project to the shuttle drive",
        description="""\
Copy the current project to the configured external shuttle drive so you
can work on it away from your main workstation.

Must be run from inside an initialised CreativeOS project directory.
The project is copied to:
  <SHUTTLE_PATH>/Projects/<relative-path-in-projects-tree>

A _TRAVEL_LOG.txt timestamp is written so you know when the project was
last exported.  Remember to eject the drive safely after.\
""",
        epilog="""\
Examples:
  cd C:\\Projects\\Video\\2026-01-15_My_Film && cos travel\
""",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        add_help=False,
    )
    p_travel.add_argument(
        "-h", "--help",
        action=RichHelpAction,
        help="Show this help message and exit.",
    )

def cmd_travel(args: argparse.Namespace) -> None:
    """Copy the current active project to the External Shuttle Drive."""
    meta, project_root = find_meta_in_cwd()
    
    if not meta:
        console.print("[error]❌ Error: You must be inside an initialized project to use 'travel'.[/error]")
        return

    console.rule(f"[bold purple]🚀 Shuttle Launch: {meta['name']}")
    
    if not os.path.exists(SHUTTLE_PATH):
        console.print(f"[error]❌ Error: Shuttle Drive not found at: {SHUTTLE_PATH}[/error]")
        console.print("   (Check your config.json or plug in the drive)")
        return

    rel_path = os.path.relpath(project_root, PROJECTS_PATH)
    dest_path = os.path.join(SHUTTLE_PATH, "Projects", rel_path)

    console.print(f"Source: {format_path(project_root)}")
    console.print(f"Target: {format_path(dest_path)}")
    
    if not Confirm.ask("Start copy? This might take a while for video."): return

    try:
        copy_with_progress(project_root, dest_path)
        
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(os.path.join(dest_path, "_TRAVEL_LOG.txt"), "a") as f:
            f.write(f"Synced from Desktop at: {timestamp}\n")
            
        console.print(Panel(f"Project ready for travel!\n{format_path(dest_path)}", title="✅ Launch Successful", style="success"))
        console.print("   [info]Don't forget to Eject safely.[/info]")
        os.startfile(dest_path)
        
    except Exception as e:
        console.print(f"[error]❌ Copy failed: {e}[/error]")

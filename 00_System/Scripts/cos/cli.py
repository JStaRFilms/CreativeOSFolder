"""Main CLI entry point."""

import argparse
import sys
import datetime
import traceback
import os
from argparse import RawTextHelpFormatter

from . import __version__
from .console import console
from .config import SCRIPT_DIR
from .commands import new, clone, init, sync, export, thumbs, clean, sort_exports, travel, resurrect
from rich.panel import Panel
from rich.table import Table
from rich import box

def handle_exception(exc_type, exc_value, exc_traceback):
    """Custom exception handler for beautiful error display via Rich."""
    if issubclass(exc_type, KeyboardInterrupt):
        console.print("\n[yellow]Operation cancelled by user.[/yellow]")
        sys.exit(1)
    
    console.print(Panel(
        f"[bold red]An unexpected error occurred:[/bold red]\n\n"
        f"[dim]{exc_type.__name__}:[/dim] {exc_value}\n\n"
        f"[dim]Full error logged to: 00_System/Config/error.log[/dim]",
        title=" Error ",
        border_style="red"
    ))
    
    log_path = os.path.join(SCRIPT_DIR, "..", "..", "Config", "error.log")
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"\n{'='*50}\n")
            f.write(f"Time: {datetime.datetime.now().isoformat()}\n")
            f.write(f"Command: {' '.join(sys.argv)}\n")
            f.write(f"Working Dir: {os.getcwd()}\n\n")
            traceback.print_exception(exc_type, exc_value, exc_traceback, file=f)
    except Exception:
        pass
    
    sys.exit(1)

def main() -> None:
    """Main entry point for CreativeOS CLI."""
    sys.excepthook = handle_exception
    
    banner = """
    ______                _   _            ___  ____
   / ____/________  ____ | | | |__   ___  / _ \/ ___|
  | |   | '__/ _ \/ _` || |_| |\ \ / / _ \| | | \___ \\
  | |___| | |  __/ (_| ||  _  | \ V /  __/ |_| |___) |
   \____|_|  \___|\__,_||_| |_|  \_/ \___|\___/|____/
    """
    
    if len(sys.argv) == 1:
        console.print(Panel.fit(f"[bold purple]{banner}[/bold purple]", title="CreativeOS CLI", border_style="purple"))
        
        table = Table(box=box.SIMPLE, show_header=False)
        table.add_column("Command", style="cyan bold")
        table.add_column("Description", style="white")
        
        table.add_row("", "[bold underline]CREATION[/bold underline]")
        table.add_row("new <name>", "Create fresh project")
        table.add_row("clone <url>", "Clone Git repo & adopt into OS")
        table.add_row("init", "Adopt current folder")
        table.add_row("", "")
        table.add_row("", "[bold underline]MAINTENANCE[/bold underline]")
        table.add_row("sync", "Sync Notes")
        table.add_row("export", "Open Export Folder")
        table.add_row("thumbs", "Update Thumbnail Gallery")
        table.add_row("clean", "Sort Downloads")
        table.add_row("travel", "Copy to Shuttle Drive")
        table.add_row("resurrect", "Restore from Archive")
        
        console.print(table)
        console.print("\nUse [bold]cos <command> -h[/bold] for flags.")
        sys.exit(0)

    parser = argparse.ArgumentParser(
        prog="cos",
        description="CreativeOS CLI",
        formatter_class=RawTextHelpFormatter
    )
    subparsers = parser.add_subparsers(dest="command", title="Commands")
    
    new.add_parser(subparsers)
    clone.add_parser(subparsers)
    init.add_parser(subparsers)
    export.add_parser(subparsers)
    sync.add_parser(subparsers)
    thumbs.add_parser(subparsers)
    clean.add_parser(subparsers)
    sort_exports.add_parser(subparsers)
    travel.add_parser(subparsers)
    resurrect.add_parser(subparsers)
    
    args = parser.parse_args()
    args.category_flag_passed = "-c" in sys.argv or "--category" in sys.argv
    
    if args.command == "new": new.cmd_new(args)
    elif args.command == "clone": clone.cmd_clone(args)
    elif args.command == "init": init.cmd_init(args)
    elif args.command == "export": export.cmd_export(args)
    elif args.command == "sync": sync.cmd_sync(args)
    elif args.command == "thumbs": thumbs.cmd_thumbs(args)
    elif args.command == "clean": clean.cmd_clean(args)
    elif args.command == "sort-exports": sort_exports.cmd_sort_exports(args)
    elif args.command == "travel": travel.cmd_travel(args)
    elif args.command == "resurrect": resurrect.cmd_resurrect(args)
    else: parser.print_help()

if __name__ == "__main__":
    main()

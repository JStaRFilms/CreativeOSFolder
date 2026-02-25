"""Init project command."""

import os
import json
import argparse
import datetime
import time
from typing import Any

from rich.panel import Panel
from rich.table import Table
from rich import box
from rich.prompt import Confirm

from ..config import PROJECTS_PATH, CONFIG_PERMISSIONS
from ..console import console
from ..file_utils import get_smart_date

def add_parser(subparsers: Any) -> None:
    subparsers.add_parser("init", help="Adopt current folder")

def cmd_init(args: argparse.Namespace) -> None:
    """Adopt the current working directory as a CreativeOS project."""
    cwd = os.getcwd()
    if not cwd.startswith(PROJECTS_PATH):
        console.print("[warning]⚠️  Not in CreativeOS Projects folder.[/warning]")
        if not Confirm.ask("Proceed anyway?"): return

    if os.path.exists(os.path.join(cwd, ".project_meta.json")):
        console.print("[success]✅ Already initialized.[/success]")
        return

    console.rule("[bold purple]Project Adoption")
    
    with console.status("[cyan]Scanning Directory Context...[/cyan]"):
        smart_ts = get_smart_date(cwd)
        date_str = datetime.datetime.fromtimestamp(smart_ts).strftime("%Y-%m-%d")
        
        current_name = os.path.basename(cwd)
        norm_path = cwd.replace("\\", "/")
        parts = norm_path.split("/")
        
        meta_client = "None"
        category = "Video"
        if "Clients" in parts:
            try: meta_client = parts[parts.index("Clients") + 1]
            except: pass
        elif "Video" in parts:
            try: 
                if len(parts) > parts.index("Video") + 2: meta_client = parts[parts.index("Video") + 1]
            except: pass
        
        if "Code" in parts: category = "Code"
        elif "Music" in parts: category = "Music"
        elif "AI" in parts: category = "AI"

        time.sleep(0.5)

    table = Table(title="Inferred Metadata", box=box.ROUNDED)
    table.add_column("Key", style="cyan")
    table.add_column("Value", style="white")
    table.add_row("Name", current_name)
    table.add_row("Category", category)
    table.add_row("Client", meta_client)
    table.add_row("Date", date_str)
    console.print(table)

    notes_dir = os.path.join(cwd, "00_Notes")
    os.makedirs(notes_dir, exist_ok=True)
    if not os.path.exists(os.path.join(notes_dir, "Idea.md")):
        with open(os.path.join(notes_dir, "Idea.md"), "w") as f:
            f.write(f"---\n"
                    f"type: project\n"
                    f"category: {category}\n"
                    f"client: {meta_client}\n"
                    f"status: active\n"
                    f"created: {date_str}\n"
                    f"tags: [creativeos]\n"
                    f"---\n\n"
                    f"# {current_name}\n")

    slug = f"{date_str}_{current_name.replace(' ', '_')}"
    meta = {
        "name": current_name, "slug": slug, "type": category,
        "created": date_str, "client": meta_client,
        "template": "adopted_existing", "root": cwd
    }
    with open(os.path.join(cwd, ".project_meta.json"), "w") as f:
        json.dump(meta, f, indent=4)
        
    meta_path = os.path.join(cwd, ".project_meta.json")
    try:
        os.chmod(meta_path, CONFIG_PERMISSIONS)
    except OSError:
        pass
        
    console.print(Panel(f"Project adopted! Slug: [bold]{slug}[/bold]", style="success"))

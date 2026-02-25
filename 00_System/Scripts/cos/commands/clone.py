"""Clone project command."""

import os
import json
import argparse
import subprocess
from typing import Any

from rich.panel import Panel
from rich.table import Table
from rich import box

from ..config import PROJECTS_PATH, CONFIG_PERMISSIONS, logger
from ..console import console
from ..security import sanitize_path_input, validate_project_name, validate_client_name, validate_date, validate_git_url
from ..file_utils import get_date_slug, format_path

def add_parser(subparsers: Any) -> None:
    p_clone = subparsers.add_parser("clone", help="Clone a repo into CreativeOS")
    p_clone.add_argument("url", type=str, help="Git repository URL")
    p_clone.add_argument("-n", "--name", type=validate_project_name)
    p_clone.add_argument(
        "-c", "--category", 
        type=str, 
        default="Video",
        choices=["Video", "Code", "Web", "AI", "Music", "Audio"]
    )
    p_clone.add_argument("-d", "--date", type=validate_date)
    p_clone.add_argument("--client", type=validate_client_name)

def cmd_clone(args: argparse.Namespace) -> None:
    """Clone an external Git repository and adopt it into CreativeOS."""
    logger.info(f"Cloning repository: {args.url}")
    url = args.url
    
    try:
        url = validate_git_url(url)
    except ValueError as e:
        console.print(f"[error]❌ {e}[/error]")
        return
        
    if not args.name:
        base_name = url.rstrip("/").split("/")[-1]
        if base_name.endswith(".git"):
            base_name = base_name[:-4]
        project_name_raw = base_name
    else:
        project_name_raw = args.name

    try:
        project_name = sanitize_path_input(project_name_raw)
    except ValueError as e:
        console.print(f"[error]❌ Invalid project name: {e}[/error]")
        return

    category = args.category.title()
    if category == "Video" and getattr(args, "category_flag_passed", False) is False:
        category = "Code"

    date_prefix = get_date_slug(args.date)
    safe_name = project_name.replace(" ", "_")
    slug = f"{date_prefix}_{safe_name}"

    cwd = os.getcwd()
    if args.client:
        try:
            sanitized_client = sanitize_path_input(args.client, max_length=50)
        except ValueError as e:
            console.print(f"[error]❌ Invalid client name: {e}[/error]")
            return
            
        target_root = os.path.join(PROJECTS_PATH, "Clients", sanitized_client)
        if not os.path.exists(target_root):
            os.makedirs(target_root)
            console.print(f"[success]✨ Created new Client folder: {sanitized_client}[/success]")
    elif cwd.startswith(PROJECTS_PATH):
        target_root = cwd
    else:
        if category.lower() in ["web", "code"]: phys_cat = "Code"
        elif category.lower() in ["music", "audio"]: phys_cat = "Music"
        elif category.lower() == "ai": phys_cat = "AI"
        else: phys_cat = "Video"
        target_root = os.path.join(PROJECTS_PATH, phys_cat)

    target_dir = os.path.join(target_root, slug)
    
    if os.path.exists(target_dir):
        console.print(f"[warning]⚠️  Target directory already exists: {target_dir}[/warning]")
        return

    info_table = Table(show_header=False, box=box.SIMPLE)
    info_table.add_row("Source", url)
    info_table.add_row("Destination", format_path(target_dir))
    console.print(Panel(info_table, title="⬇️  Cloning Repository", border_style="cyan"))

    try:
        with console.status("[bold cyan]Cloning...[/bold cyan]"):
            subprocess.run(["git", "clone", "--", url, target_dir], check=True)
    except Exception as e:
        console.print(f"[error]❌ Git Clone failed: {e}[/error]")
        return

    console.print("🪄  Blessing project with CreativeOS metadata...")
    notes_dir = os.path.join(target_dir, "00_Notes")
    os.makedirs(notes_dir, exist_ok=True)
    if not os.path.exists(os.path.join(notes_dir, "Idea.md")):
        with open(os.path.join(notes_dir, "Idea.md"), "w") as f:
            f.write(f"# {project_name}\nType: Cloned Repository\nSource: {url}\nDate: {date_prefix}\n")

    meta_client = "None"
    if args.client: meta_client = args.client
    else:
        norm_path = target_root.replace("\\", "/")
        parts = norm_path.split("/")
        if "Clients" in parts:
            try: meta_client = parts[parts.index("Clients") + 1]
            except: pass

    meta = {
        "name": project_name, "slug": slug, "type": category,
        "created": date_prefix, "client": meta_client,
        "template": "git_clone", "repo_url": url, "root": target_dir
    }
    with open(os.path.join(target_dir, ".project_meta.json"), "w") as f:
        json.dump(meta, f, indent=4)

    meta_path = os.path.join(target_dir, ".project_meta.json")
    try:
        os.chmod(meta_path, CONFIG_PERMISSIONS)
    except OSError:
        pass

    logger.debug(f"Clone complete: {target_dir}")
    console.print(Panel(f"Clone Complete!\n{format_path(target_dir)}", style="success"))

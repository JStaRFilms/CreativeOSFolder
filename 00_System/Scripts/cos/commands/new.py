"""New project command."""

import os
import json
import argparse
from typing import Any

from rich.panel import Panel
from rich.table import Table
from rich import box

from ..config import PROJECTS_PATH, TEMPLATES_PATH, CONFIG_PERMISSIONS, logger
from ..console import console
from ..security import sanitize_path_input, validate_project_name, validate_client_name, validate_date
from ..git_utils import setup_git
from ..file_utils import get_date_slug, format_path

def add_parser(subparsers: Any) -> None:
    from ..help_formatter import RichHelpAction

    p_new = subparsers.add_parser(
        "new",
        help="Create a new project from template",
        description="""\
Create a new project with the specified name and category.

The project is created in the appropriate category folder with a
date-prefixed slug, e.g. 2026-02-25_My_Project.

A .project_meta.json file is written to track the project and a
structured 00_Notes/Idea.md is seeded with front-matter metadata.\
""",
        epilog="""\
Examples:
  cos new "My Video"                     Create a Video project (default category)
  cos new "Web App" -c Code              Create a Code project
  cos new "Podcast" -c Audio             Create an Audio project
  cos new "Logo Design" -c Design        Create a Design project
  cos new "App" -c Code --git            Create Code project with Git initialised
  cos new "Client Work" --client Acme    Create project inside Clients/Acme/
  cos new "Retro Cut" -d 2025-12-01      Create project backdated to 2025-12-01

Templates:
  Video  -> video_project   (00_Notes, 01_Footage, 02_Audio, 03_Exports, 04_Assets)
  Code   -> plain_code      (00_Notes, 01_Source, 02_Build, 03_Docs)
  Audio  -> audio_project   (00_Notes, 01_Recording, 02_Edits, 03_Exports)
  AI     -> ai_project      (00_Notes, 01_Data, 02_Models, 03_Notebooks, 04_Exports)
  Web    -> code_project    (00_Notes, 01_Source, 02_Public, 03_Config)\
""",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        add_help=False,
    )

    p_new.add_argument(
        "name",
        type=validate_project_name,
        help="Project name. Spaces, hyphens and underscores are allowed.",
    )
    p_new.add_argument(
        "-c", "--category",
        type=str,
        default="Video",
        choices=["Video", "Code", "Web", "AI", "Music", "Audio"],
        help="Project category — determines the folder template used.  (default: Video)",
    )
    p_new.add_argument(
        "-s", "--simple",
        action="store_true",
        help="Use the minimal 'simple' template instead of the full category template.",
    )
    p_new.add_argument(
        "-d", "--date",
        type=validate_date,
        help="Override the creation date prefix (YYYY-MM-DD).  Default: today.",
    )
    p_new.add_argument(
        "--client",
        type=validate_client_name,
        help="Client name — project is created inside Clients/<client>/ instead of the category folder.",
    )
    p_new.add_argument(
        "-g", "--git",
        action="store_true",
        help="Initialise a Git repository inside the new project folder.",
    )
    p_new.add_argument(
        "-h", "--help",
        action=RichHelpAction,
        help="Show this help message and exit.",
    )

def cmd_new(args: argparse.Namespace) -> None:
    """Create a new project."""
    logger.info(f"Creating new project: {args.name} (category: {args.category})")
    try:
        project_name = sanitize_path_input(args.name)
    except ValueError as e:
        console.print(f"[error]❌ Invalid project name: {e}[/error]")
        return
        
    category = args.category.title()
    date_prefix = get_date_slug(args.date)
    safe_name = project_name.replace(" ", "_")
    slug = f"{date_prefix}_{safe_name}"

    cwd = os.getcwd()
    target_root = None
    
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
    
    info_table = Table(show_header=False, box=box.SIMPLE)
    info_table.add_row("Project Name", f"[project]{project_name}[/project]")
    info_table.add_row("Slug", slug)
    info_table.add_row("Category", category)
    info_table.add_row("Location", format_path(target_dir))
    if args.client: info_table.add_row("Client", args.client)
    
    console.print(Panel(info_table, title="🚀 Launching New Project", border_style="purple"))

    if os.path.exists(target_dir):
        console.print(f"[warning]⚠️  Project already exists: {target_dir}[/warning]")
        return

    cat_lower = category.lower()
    if args.simple: template_name = "simple"
    elif cat_lower == "code": template_name = "plain_code"
    elif cat_lower == "web": template_name = "code_project"
    elif cat_lower in ["music", "audio"]: template_name = "audio_project"
    elif cat_lower == "ai": template_name = "ai_project"
    else: template_name = "video_project"

    template_file = os.path.join(TEMPLATES_PATH, template_name, "structure.json")
    if not os.path.exists(template_file):
        console.print(f"[error]❌ Template not found: {template_name}[/error]")
        return

    with open(template_file, "r") as f: structure = json.load(f)

    with console.status(f"[bold cyan]Construction in progress ({template_name})...[/bold cyan]"):
        os.makedirs(target_dir)

        meta_client = "None"
        if args.client: meta_client = args.client
        else:
            norm_path = target_root.replace("\\", "/")
            parts = norm_path.split("/")
            if "Clients" in parts:
                try: meta_client = parts[parts.index("Clients") + 1]
                except: pass
            elif "Video" in parts:
                 try:
                     if len(parts) > parts.index("Video") + 1: meta_client = parts[parts.index("Video") + 1]
                 except: pass

        for folder, contents in structure.items():
            folder_path = os.path.join(target_dir, folder)
            os.makedirs(folder_path, exist_ok=True)
            for item in contents:
                if "." in item:
                    if not os.path.exists(os.path.join(folder_path, item)):
                        with open(os.path.join(folder_path, item), "w") as f:
                            f.write(f"# {item}\nProject: {project_name}\nCreated: {date_prefix}\n")
                else: os.makedirs(os.path.join(folder_path, item), exist_ok=True)

        notes_dir = os.path.join(target_dir, "00_Notes")
        os.makedirs(notes_dir, exist_ok=True)
        with open(os.path.join(notes_dir, "Idea.md"), "w") as f:
            f.write(f"---\n"
                    f"type: project\n"
                    f"category: {category}\n"
                    f"client: {meta_client}\n"
                    f"status: active\n"
                    f"created: {date_prefix}\n"
                    f"tags: [creativeos]\n"
                    f"---\n\n"
                    f"# {project_name}\n")

        meta = {
            "name": project_name, "slug": slug, "type": category,
            "created": date_prefix, "client": meta_client,
            "template": template_name, "root": target_dir
        }
        with open(os.path.join(target_dir, ".project_meta.json"), "w") as f:
            json.dump(meta, f, indent=4)
            
        meta_path = os.path.join(target_dir, ".project_meta.json")
        try:
            os.chmod(meta_path, CONFIG_PERMISSIONS)
        except OSError:
            pass

    if args.git:
        setup_git(target_dir, category)
    
    logger.debug(f"Project created at: {target_dir}")
    console.print(Panel(f"Project successfully spawned at:\n{format_path(target_dir)}", style="bold green", title="✅ Success"))

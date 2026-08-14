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
from ..category_config import (
    get_enabled_category_names,
    get_category,
    get_category_template,
    get_category_folder,
    get_default_category,
    get_simple_template,
    resolve_category_name,
    category_exists,
)

import datetime
from pathlib import Path

def _apply_template_variables(target_dir: str, name: str, category: str, client: str) -> None:
    """Replace {{VARIABLE}} tokens in all .md files after template creation.
    
    Args:
        target_dir: Path to the new project directory.
        name: Project name.
        category: Project category.
        client: Client name.
    """
    replacements = {
        "{{PROJECT_NAME}}": name,
        "{{DATE}}": datetime.date.today().isoformat(),
        "{{CLIENT}}": client or "N/A",
        "{{TYPE}}": category,
    }
    
    project_path = Path(target_dir)
    for md_file in project_path.rglob("*.md"):
        try:
            content = md_file.read_text(encoding="utf-8")
            changed = False
            for token, value in replacements.items():
                if token in content:
                    content = content.replace(token, value)
                    changed = True
            if changed:
                md_file.write_text(content, encoding="utf-8")
        except Exception as e:
            logger.warning(f"Could not apply variables to {md_file}: {e}")

def validate_category(val: str) -> str:
    """Normalize and validate category input to be case-insensitive.
    
    Uses dynamic categories from categories.json configuration.
    Falls back to the input value if not found (for custom categories).
    """
    # Resolve category name (handles aliases too)
    resolved = resolve_category_name(val)
    if category_exists(val):
        return resolved
    # Return the value as-is for custom categories
    return val

def add_parser(subparsers: Any) -> None:
    from ..help_formatter import RichHelpAction
    
    # Get dynamic categories for choices
    category_choices = get_enabled_category_names()
    default_category = get_default_category()

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

Use 'cos category list' to see all available categories and their templates.\
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
        "-c", "--category", "--type",
        type=validate_category,
        default=default_category,
        choices=category_choices,
        help=f"Project category — determines the folder template used.  (default: {default_category})",
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


def create_project_structure(
    name: str,
    category: str = "Video",
    client: str | None = None,
    destination_subpath: str | None = None,
    date: str | None = None,
    simple: bool = False,
    git: bool = False,
    target_root_override: str | None = None,
    interactive: bool = False,
) -> dict[str, Any]:
    """Programmatically create a new project directory and metadata.
    
    Returns:
        dict containing project metadata.
    Raises:
        ValueError: if project name or client name is invalid.
        FileExistsError: if target directory already exists.
        FileNotFoundError: if template structure is missing.
    """
    project_name = sanitize_path_input(name)
    resolved_category = validate_category(category)
    date_prefix = get_date_slug(date)
    safe_name = project_name.replace(" ", "_")
    slug = f"{date_prefix}_{safe_name}"

    if client:
        sanitized_client = sanitize_path_input(client, max_length=50)
        base_root = os.path.join(PROJECTS_PATH, "Clients", sanitized_client)
    else:
        phys_cat = get_category_folder(resolved_category)
        base_root = os.path.join(PROJECTS_PATH, phys_cat)

    if target_root_override:
        target_root = target_root_override
    elif destination_subpath:
        sub_parts = [sanitize_path_input(p) for p in destination_subpath.strip().replace("\\", "/").split("/") if p.strip()]
        target_root = os.path.join(base_root, *sub_parts) if sub_parts else base_root
    else:
        target_root = base_root

    os.makedirs(target_root, exist_ok=True)
    target_dir = os.path.join(target_root, slug)

    if os.path.exists(target_dir):
        raise FileExistsError(f"Project already exists: {target_dir}")

    if simple:
        template_name = get_simple_template()
    else:
        template_name = get_category_template(resolved_category)

    template_dir = os.path.join(TEMPLATES_PATH, template_name)
    template_file = os.path.join(template_dir, "structure.json")
    if not os.path.exists(template_file):
        raise FileNotFoundError(f"Template structure not found: {template_name}")

    with open(template_file, "r", encoding="utf-8") as f:
        structure = json.load(f)

    os.makedirs(target_dir, exist_ok=True)

    meta_client = "None"
    if client:
        meta_client = client
    else:
        norm_path = target_root.replace("\\", "/")
        parts = norm_path.split("/")
        if "Clients" in parts:
            try:
                meta_client = parts[parts.index("Clients") + 1]
            except Exception:
                pass
        elif "Video" in parts:
            try:
                if len(parts) > parts.index("Video") + 1:
                    meta_client = parts[parts.index("Video") + 1]
            except Exception:
                pass

    for folder, contents in structure.items():
        folder_path = os.path.join(target_dir, folder)
        os.makedirs(folder_path, exist_ok=True)
        for item in contents:
            if "." in item:
                item_target = os.path.join(folder_path, item)
                if not os.path.exists(item_target):
                    source_file = os.path.join(template_dir, folder, item)
                    if os.path.exists(source_file):
                        import shutil
                        shutil.copy2(source_file, item_target)
                    else:
                        with open(item_target, "w", encoding="utf-8") as f:
                            f.write(f"# {item}\nProject: {project_name}\nCreated: {date_prefix}\n")
            else:
                os.makedirs(os.path.join(folder_path, item), exist_ok=True)

    _apply_template_variables(target_dir, project_name, resolved_category, client or "")

    notes_dir = os.path.join(target_dir, "00_Notes")
    os.makedirs(notes_dir, exist_ok=True)
    with open(os.path.join(notes_dir, "Idea.md"), "w", encoding="utf-8") as f:
        f.write(
            f"---\n"
            f"type: project\n"
            f"category: {resolved_category}\n"
            f"client: {meta_client}\n"
            f"status: active\n"
            f"created: {date_prefix}\n"
            f"tags: [creativeos]\n"
            f"---\n\n"
            f"# {project_name}\n"
        )

    meta = {
        "name": project_name,
        "slug": slug,
        "type": resolved_category,
        "created": date_prefix,
        "client": meta_client,
        "template": template_name,
        "root": target_dir,
    }
    with open(os.path.join(target_dir, ".project_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=4)

    meta_path = os.path.join(target_dir, ".project_meta.json")
    try:
        os.chmod(meta_path, CONFIG_PERMISSIONS)
    except OSError:
        pass

    if git:
        setup_git(target_dir, resolved_category, interactive=interactive)

    logger.debug(f"Project created at: {target_dir}")
    meta["path"] = target_dir
    return meta


def cmd_new(args: argparse.Namespace) -> None:
    """Create a new project."""
    logger.info(f"Creating new project: {args.name} (category: {args.category})")
    
    cwd = os.getcwd()
    target_root_override = cwd if cwd.startswith(PROJECTS_PATH) else None

    try:
        meta = create_project_structure(
            name=args.name,
            category=args.category,
            client=args.client,
            date=args.date,
            simple=args.simple,
            git=args.git,
            target_root_override=target_root_override,
            interactive=True,
        )
    except ValueError as e:
        console.print(f"[error]❌ Invalid input: {e}[/error]")
        return
    except FileExistsError as e:
        console.print(f"[warning]⚠️  {e}[/warning]")
        return
    except FileNotFoundError as e:
        console.print(f"[error]❌ {e}[/error]")
        return

    info_table = Table(show_header=False, box=box.SIMPLE)
    info_table.add_row("Project Name", f"[project]{meta['name']}[/project]")
    info_table.add_row("Slug", meta["slug"])
    info_table.add_row("Category", meta["type"])
    info_table.add_row("Location", format_path(meta["root"]))
    if meta.get("client") and meta["client"] != "None":
        info_table.add_row("Client", meta["client"])

    console.print(Panel(info_table, title="🚀 Launching New Project", border_style="purple"))
    console.print(Panel(f"Project successfully spawned at:\n{format_path(meta['root'])}", style="bold green", title="✅ Success"))


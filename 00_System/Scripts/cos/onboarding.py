"""First-run onboarding wizard for CreativeOS.

This module provides an interactive setup wizard that runs when
CreativeOS is started for the first time or when configuration is missing.
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from .console import console as default_console

# Setup logger
logger = logging.getLogger('creativeos')

# Default paths for suggestions
DEFAULT_PATHS = {
    "projects_path": str(Path.home() / "CreativeOS" / "Projects"),
    "vault_path": str(Path.home() / "CreativeOS" / "Vault"),
    "archive_path": str(Path.home() / "CreativeOS" / "Archive"),
    "shuttle_path": str(Path.home() / "CreativeOS" / "Shuttle"),
    "exports_path": str(Path.home() / "CreativeOS" / "Exports"),
}

# Available category presets
CATEGORY_PRESETS = {
    "Video": {"icon": "🎬", "desc": "Video production projects"},
    "Code": {"icon": "💻", "desc": "Software development"},
    "Audio": {"icon": "🎵", "desc": "Audio and music production"},
    "AI": {"icon": "🤖", "desc": "AI and machine learning"},
    "Design": {"icon": "🎨", "desc": "Graphic design"},
    "Photo": {"icon": "📷", "desc": "Photography"},
    "Writing": {"icon": "✍️", "desc": "Writing and blogging"},
    "Podcast": {"icon": "🎙️", "desc": "Podcast production"},
    "Course": {"icon": "📚", "desc": "Online course creation"},
}


def is_first_run() -> bool:
    """Check if this is the first run of CreativeOS.
    
    Returns:
        True if config.json or categories.json is missing.
    """
    base_path = Path(__file__).parent.parent.parent
    config_path = base_path / "Config" / "config.json"
    categories_path = base_path / "Config" / "categories.json"
    
    return not config_path.exists() or not categories_path.exists()


def run_onboarding_wizard(console: Console = None) -> Optional[Dict[str, Any]]:
    """Run the interactive onboarding wizard.
    
    Args:
        console: Rich console instance for output.
        
    Returns:
        Dictionary with configuration values, or None if cancelled.
    """
    # Import questionary here to allow graceful fallback if not installed
    try:
        import questionary
    except ImportError:
        console = console or default_console
        console.print("[error]❌ questionary not installed. Run: pip install questionary[/error]")
        return None
    
    if console is None:
        console = default_console
    
    console.clear()
    
    # Welcome banner
    banner = """
  ██████╗██████╗ ███████╗ █████╗ ████████╗██╗██╗   ██╗███████╗ ██████╗ ███████╗
 ██╔════╝██╔══██╗██╔════╝██╔══██╗╚══██╔══╝██║██║   ██║██╔════╝██╔═══██╗██╔════╝
 ██║     ██████╔╝█████╗  ███████║   ██║   ██║██║   ██║█████╗  ██║   ██║███████╗
 ██║     ██╔══██╗██╔══╝  ██╔══██║   ██║   ██║╚██╗ ██╔╝██╔══╝  ██║   ██║╚════██║
 ╚██████╗██║  ██║███████╗██║  ██║   ██║   ██║ ╚████╔╝ ███████╗╚██████╔╝███████║
  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═══╝  ╚══════╝ ╚═════╝ ╚══════╝
    """
    
    console.print(Panel.fit(
        f"[bold purple]{banner}[/bold purple]\n\n"
        "[cyan]Welcome to CreativeOS![/cyan]\n\n"
        "This wizard will help you set up your creative workflow system.\n"
        "You can always change these settings later with [bold]cos setup[/bold].",
        border_style="purple",
        padding=(1, 2)
    ))
    
    console.print()
    
    # Step 1: Configure Paths
    console.print("[bold cyan]Step 1: Configure Your Paths[/bold cyan]")
    console.print("[dim]Where should CreativeOS store your projects and files?[/dim]")
    console.print()
    
    config: Dict[str, Any] = {}
    
    # Projects path
    projects_path = questionary.path(
        "Projects folder (where your active projects live):",
        default=DEFAULT_PATHS["projects_path"],
        only_directories=True,
    ).ask()
    if projects_path:
        config["projects_path"] = os.path.abspath(projects_path)
    
    # Vault path
    vault_path = questionary.path(
        "Vault folder (for Obsidian notes sync):",
        default=DEFAULT_PATHS["vault_path"],
        only_directories=True,
    ).ask()
    if vault_path:
        config["vault_path"] = os.path.abspath(vault_path)
    
    # Archive path
    archive_path = questionary.path(
        "Archive folder (for completed projects):",
        default=DEFAULT_PATHS["archive_path"],
        only_directories=True,
    ).ask()
    if archive_path:
        config["archive_path"] = os.path.abspath(archive_path)
    
    # Shuttle path
    shuttle_path = questionary.path(
        "Shuttle folder (for portable drive sync):",
        default=DEFAULT_PATHS["shuttle_path"],
        only_directories=True,
    ).ask()
    if shuttle_path:
        config["shuttle_path"] = os.path.abspath(shuttle_path)
    
    # Exports path
    exports_path = questionary.path(
        "Exports folder (for rendered files):",
        default=DEFAULT_PATHS["exports_path"],
        only_directories=True,
    ).ask()
    if exports_path:
        config["exports_path"] = os.path.abspath(exports_path)
    
    console.print()
    
    # Step 2: Select Categories
    console.print("[bold cyan]Step 2: Select Your Categories[/bold cyan]")
    console.print("[dim]Which project types do you work with?[/dim]")
    console.print()
    
    selected_categories = questionary.checkbox(
        "Select categories to enable (space to select, enter to confirm):",
        choices=[
            questionary.Choice(f"{info['icon']} {cat} - {info['desc']}", checked=True)
            for cat, info in CATEGORY_PRESETS.items()
        ],
    ).ask()
    
    # Parse selected categories
    enabled_categories = []
    for selection in (selected_categories or []):
        # Extract category name from "🎬 Video - Video production projects"
        cat_name = selection.split()[1] if " " in selection else selection
        enabled_categories.append(cat_name)
    
    console.print()
    
    # Step 3: Default Category
    console.print("[bold cyan]Step 3: Choose Default Category[/bold cyan]")
    console.print("[dim]Which category should be used by default?[/dim]")
    console.print()
    
    default_category = questionary.select(
        "Default category:",
        choices=enabled_categories or list(CATEGORY_PRESETS.keys()),
    ).ask()
    
    console.print()
    
    # Step 4: Summary
    console.print("[bold cyan]Step 4: Confirm Your Setup[/bold cyan]")
    console.print()
    
    summary_table = Table(show_header=False, box=None)
    summary_table.add_column("Setting", style="cyan")
    summary_table.add_column("Value", style="white")
    
    summary_table.add_row("Projects Path", config.get("projects_path", "Not set"))
    summary_table.add_row("Vault Path", config.get("vault_path", "Not set"))
    summary_table.add_row("Archive Path", config.get("archive_path", "Not set"))
    summary_table.add_row("Shuttle Path", config.get("shuttle_path", "Not set"))
    summary_table.add_row("Exports Path", config.get("exports_path", "Not set"))
    summary_table.add_row("Enabled Categories", ", ".join(enabled_categories) or "All")
    summary_table.add_row("Default Category", default_category or "Video")
    
    console.print(Panel(summary_table, title="Configuration Summary", border_style="green"))
    console.print()
    
    # Confirm
    confirm = questionary.confirm(
        "Apply this configuration?",
        default=True,
    ).ask()
    
    if not confirm:
        console.print("[yellow]Setup cancelled. Run 'cos setup' to try again.[/yellow]")
        return None
    
    config["enabled_categories"] = enabled_categories
    config["default_category"] = default_category
    
    return config


def apply_configuration(config: Dict[str, Any]) -> bool:
    """Apply the configuration from onboarding wizard.
    
    Args:
        config: Configuration dictionary from wizard.
        
    Returns:
        True if successful, False otherwise.
    """
    if not config:
        return False
    
    console = default_console
    base_path = Path(__file__).parent.parent.parent
    config_dir = base_path / "Config"
    config_dir.mkdir(parents=True, exist_ok=True)
    
    # Create config.json
    main_config = {
        "root_path": str(base_path.parent),
        "projects_path": config.get("projects_path", DEFAULT_PATHS["projects_path"]),
        "exports_path": config.get("exports_path", DEFAULT_PATHS["exports_path"]),
        "templates_path": str(base_path / "Templates"),
        "vault_path": config.get("vault_path", DEFAULT_PATHS["vault_path"]),
        "shuttle_path": config.get("shuttle_path", DEFAULT_PATHS["shuttle_path"]),
        "archive_path": config.get("archive_path", DEFAULT_PATHS["archive_path"]),
        "version": "2.1.0",
    }
    
    try:
        with open(config_dir / "config.json", "w", encoding="utf-8") as f:
            json.dump(main_config, f, indent=4)
        
        logger.info("Created config.json from onboarding wizard")
    except (IOError, OSError) as e:
        logger.error(f"Failed to create config.json: {e}")
        console.print(f"[error]❌ Failed to save configuration: {e}[/error]")
        return False
    
    # Create directories if they don't exist
    for path_key in ["projects_path", "vault_path", "archive_path", "exports_path"]:
        path = Path(main_config[path_key])
        try:
            path.mkdir(parents=True, exist_ok=True)
            logger.debug(f"Created directory: {path}")
        except (IOError, OSError) as e:
            logger.warning(f"Could not create directory {path}: {e}")
    
    console.print("[green]✅ Configuration saved![/green]")
    console.print("[green]✅ Created project directories![/green]")
    
    return True


def create_default_categories() -> bool:
    """Create default categories.json if it doesn't exist.
    
    Returns:
        True if successful, False otherwise.
    """
    from .category_config import DEFAULT_CATEGORIES, save_categories
    
    base_path = Path(__file__).parent.parent.parent
    categories_path = base_path / "Config" / "categories.json"
    
    if categories_path.exists():
        return True
    
    config = {
        "version": "1.0",
        "default_category": "Video",
        "simple_template": "simple",
        "categories": DEFAULT_CATEGORIES,
        "available_icons": ["🎬", "💻", "🎵", "🤖", "🎨", "📷", "✍️", "🎙️", "📚", "👥", "🎮", "📱", "🔧", "📊", "🎯"]
    }
    
    return save_categories(config)

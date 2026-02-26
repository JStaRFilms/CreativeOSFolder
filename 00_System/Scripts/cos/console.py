"""Rich console setup for CreativeOS."""

from rich.console import Console
from rich.theme import Theme

custom_theme = Theme({
    "info": "cyan",
    "warning": "yellow",
    "error": "bold red",
    "success": "bold green",
    "project": "bold purple",
    "path": "blue underline"
})

console = Console(theme=custom_theme)

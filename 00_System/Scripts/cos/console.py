"""Rich console setup for CreativeOS."""

import sys
from rich.console import Console
from rich.theme import Theme

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

custom_theme = Theme({
    "info": "cyan",
    "warning": "yellow",
    "error": "bold red",
    "success": "bold green",
    "project": "bold purple",
    "path": "blue underline"
})

console = Console(theme=custom_theme, legacy_windows=False)


"""Desktop App command for self-contained CreativeOS execution."""

import argparse
from typing import Any

from rich.panel import Panel

from .. import __version__
from ..console import console
from ..launcher import (
    DEFAULT_HOST,
    DEFAULT_PORT,
    install_desktop_shortcuts,
    run_app_lifecycle,
)


def add_parser(subparsers: Any) -> None:
    """Add the 'app' subcommand parser."""
    from ..help_formatter import RichHelpAction

    p_app = subparsers.add_parser(
        "app",
        help="Launch self-contained CreativeOS Desktop App",
        description="""\
Launch CreativeOS in a self-contained, frameless standalone desktop app window.

- Reuses existing server if one is already running.
- Starts a silent background server if none exists, and automatically terminates
  the background server when you close the app window.
""",
        epilog="""\
Examples:
  cos app                     Launch standalone desktop app window
  cos app --install-shortcut  Install Desktop and Start Menu shortcuts with icon
  cos app --port 9000         Launch desktop app on custom port\
""",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        add_help=False,
    )

    p_app.add_argument(
        "-p", "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"Port to connect/bind to (default: {DEFAULT_PORT}).",
    )
    p_app.add_argument(
        "--host",
        type=str,
        default=DEFAULT_HOST,
        help=f"Host address to bind to (default: {DEFAULT_HOST}).",
    )
    p_app.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload for local UI development.",
    )
    p_app.add_argument(
        "--install-shortcut",
        action="store_true",
        help="Create Windows Desktop and Start Menu shortcuts ready for taskbar pinning.",
    )
    p_app.add_argument(
        "-h", "--help",
        action=RichHelpAction,
        help="Show this help message and exit.",
    )


def cmd_app(args: argparse.Namespace) -> None:
    """Handle the 'cos app' command."""
    if getattr(args, "install_shortcut", False):
        created = install_desktop_shortcuts()
        if created:
            paths_str = "\n".join(f"  • [green]{p}[/green]" for p in created)
            console.print(
                Panel.fit(
                    f"[bold green]✨ CreativeOS Desktop Shortcuts Installed![/bold green]\n\n"
                    f"{paths_str}\n\n"
                    f"[dim]Right-click the Desktop or Start Menu shortcut and select [bold]'Pin to taskbar'[/bold].[/dim]",
                    title="🚀 Shortcut Installer",
                    border_style="green",
                    padding=(1, 2),
                )
            )
        else:
            console.print("[yellow]⚠️ Could not create shortcuts (only supported on Windows).[/yellow]")
        return

    run_app_lifecycle(host=args.host, port=args.port, reload=getattr(args, "reload", False))

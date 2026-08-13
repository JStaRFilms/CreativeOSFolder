"""GUI command to launch the CreativeOS web interface."""

import argparse
import threading
import time
import webbrowser
from typing import Any

from rich.panel import Panel

from .. import __version__
from ..console import console
from ..config import logger


def add_parser(subparsers: Any) -> None:
    """Add the 'gui' subcommand parser."""
    from ..help_formatter import RichHelpAction

    p_gui = subparsers.add_parser(
        "gui",
        help="Launch the CreativeOS Web GUI",
        description="""\
Launch the lightweight CreativeOS Web GUI server and open your default browser.

Provides a fast, visual dashboard to monitor projects, inspect storage,
spawn new projects, and synchronize your Obsidian knowledge base.\
""",
        epilog="""\
Examples:
  cos gui                     Launch Web GUI on http://127.0.0.1:8787
  cos gui --port 9000         Launch Web GUI on custom port 9000
  cos gui --no-browser        Launch backend server without opening browser
  cos gui --reload            Launch with auto-reload for local UI development\
""",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        add_help=False,
    )

    p_gui.add_argument(
        "-p", "--port",
        type=int,
        default=8787,
        help="Port to bind the GUI server to (default: 8787).",
    )
    p_gui.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Host address to bind to (default: 127.0.0.1).",
    )
    p_gui.add_argument(
        "--no-browser",
        action="store_true",
        help="Start the server without opening the default web browser.",
    )
    p_gui.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload for local development.",
    )
    p_gui.add_argument(
        "-h", "--help",
        action=RichHelpAction,
        help="Show this help message and exit.",
    )


def cmd_gui(args: argparse.Namespace) -> None:
    """Launch the FastAPI server and open the browser."""
    try:
        import uvicorn
    except ImportError:
        console.print(
            "[error]❌ uvicorn is not installed. Install with: pip install -r requirements.txt[/error]"
        )
        return

    url = f"http://{args.host}:{args.port}"
    logger.info(f"Starting CreativeOS GUI at {url}")

    console.print(
        Panel.fit(
            f"[bold cyan]CreativeOS Web GUI[/bold cyan] [dim]v{__version__}[/dim]\n\n"
            f"Server running at: [bold green]{url}[/bold green]\n"
            f"API documentation: [dim]{url}/docs[/dim]\n\n"
            f"[dim]Press [bold]Ctrl+C[/bold] to stop the server.[/dim]",
            title="✨ CreativeOS GUI",
            border_style="cyan",
            padding=(1, 2),
        )
    )

    if not args.no_browser:
        def _open_browser():
            time.sleep(0.8)
            try:
                webbrowser.open(url)
            except Exception as e:
                logger.warning(f"Could not open browser automatically: {e}")

        browser_thread = threading.Thread(target=_open_browser, daemon=True)
        browser_thread.start()

    try:
        uvicorn.run(
            "cos.api:app",
            host=args.host,
            port=args.port,
            reload=args.reload,
            log_level="info",
        )
    except KeyboardInterrupt:
        console.print("\n[yellow]GUI server stopped.[/yellow]")

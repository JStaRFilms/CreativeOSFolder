"""Custom Rich-powered help formatter for CreativeOS CLI.

Provides a drop-in argparse Action that renders --help output using Rich
panels, tables, and styled text instead of the default plain-text formatter.
"""

import argparse
import sys
from typing import Any, Optional, Sequence

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich import box


class RichHelpAction(argparse.Action):
    """Custom argparse action that displays help using Rich formatting.

    Use this as ``action=RichHelpAction`` (or pass the class via
    ``add_argument``) instead of the built-in ``"help"`` action so that each
    command's ``-h / --help`` output is rendered with Rich panels and tables.
    """

    def __init__(
        self,
        option_strings: Sequence[str],
        dest: str = argparse.SUPPRESS,
        default: str = argparse.SUPPRESS,
        help: Optional[str] = None,
    ) -> None:
        super().__init__(
            option_strings=option_strings,
            dest=dest,
            default=default,
            nargs=0,
            help=help,
        )

    # ------------------------------------------------------------------
    # Core render
    # ------------------------------------------------------------------

    def __call__(
        self,
        parser: argparse.ArgumentParser,
        namespace: argparse.Namespace,
        values: Any,
        option_string: Optional[str] = None,
    ) -> None:
        """Render richly-formatted help and exit."""
        console = Console()

        # ── Description ────────────────────────────────────────────────
        if parser.description:
            console.print(
                Panel(
                    parser.description.strip(),
                    title=f"[bold cyan]{parser.prog}[/bold cyan]",
                    border_style="cyan",
                    padding=(1, 2),
                )
            )
        else:
            console.print(f"\n[bold cyan]{parser.prog}[/bold cyan]\n")

        # ── Usage ──────────────────────────────────────────────────────
        console.print(f"[bold]Usage:[/bold]  [cyan]{parser.prog}[/cyan] [options]\n")

        # ── Options table ──────────────────────────────────────────────
        positional: list[tuple[str, str]] = []
        optional: list[tuple[str, str]] = []

        for action in parser._actions:
            # Skip the help action itself to avoid recursion in the table
            if isinstance(action, RichHelpAction):
                continue

            flags = ", ".join(action.option_strings) if action.option_strings else action.dest
            help_text = action.help or ""

            # Annotate choices
            if action.choices:
                help_text += f"  [dim]{{{'|'.join(str(c) for c in action.choices)}}}[/dim]"

            # Annotate defaults (only for optional flags, skip SUPPRESS and None)
            if action.option_strings and action.default is not None and action.default is not argparse.SUPPRESS:
                # Don't show True/False defaults for store_true/store_false as they are obvious
                if not isinstance(action, (argparse._StoreTrueAction, argparse._StoreFalseAction)):
                    help_text += f"  [dim](default: {action.default})[/dim]"

            if action.option_strings:
                optional.append((flags, help_text))
            else:
                positional.append((flags, help_text))

        if positional:
            pos_table = Table(
                title="Arguments",
                box=box.ROUNDED,
                border_style="dim",
                show_header=True,
                header_style="bold magenta",
                padding=(0, 1),
            )
            pos_table.add_column("Argument", style="cyan bold", no_wrap=True)
            pos_table.add_column("Description", style="white")
            for flag, desc in positional:
                pos_table.add_row(flag, desc)
            console.print(pos_table)
            console.print()

        if optional:
            opt_table = Table(
                title="Options",
                box=box.ROUNDED,
                border_style="dim",
                show_header=True,
                header_style="bold magenta",
                padding=(0, 1),
            )
            opt_table.add_column("Flag", style="cyan bold", no_wrap=True)
            opt_table.add_column("Description", style="white")
            opt_table.add_row("-h, --help", "Show this help message and exit")
            for flag, desc in optional:
                opt_table.add_row(flag, desc)
            console.print(opt_table)

        # ── Epilog / Examples ──────────────────────────────────────────
        if parser.epilog:
            console.print()
            console.print(
                Panel(
                    parser.epilog.strip(),
                    title="[bold green]Examples[/bold green]",
                    border_style="green",
                    padding=(1, 2),
                )
            )

        console.print()
        parser.exit()

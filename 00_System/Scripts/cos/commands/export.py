"""Export command."""

import os
import argparse
from typing import Any

from ..console import console
from ..file_utils import get_export_month_path, find_meta_in_cwd, format_path

def add_parser(subparsers: Any) -> None:
    from ..help_formatter import RichHelpAction

    p_exp = subparsers.add_parser(
        "export",
        help="Open the project or monthly export folder",
        description="""\
Open the export destination for the current project (or the current
month's export root if not inside a project).

When run from inside an initialised project, creates the per-project
export structure (Video/, Thumbnail/, Audio/) and opens it in Explorer.
Otherwise opens the current Year/Month export folder.\
""",
        epilog="""\
Examples:
  cos export               Open the project export folder (auto-detected)
  cos export --simple      Open the generic month folder only\
""",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        add_help=False,
    )
    p_exp.add_argument(
        "-s", "--simple",
        action="store_true",
        help="Skip project detection and open the generic monthly export folder.",
    )
    p_exp.add_argument(
        "-h", "--help",
        action=RichHelpAction,
        help="Show this help message and exit.",
    )

def cmd_export(args: argparse.Namespace) -> None:
    """Open the export directory for the project or the current month."""
    month_path = get_export_month_path()
    meta, project_root = find_meta_in_cwd()
    
    if meta and not args.simple:
        path = os.path.join(month_path, meta["slug"])
        for s in ["Video", "Thumbnail", "Audio"]: os.makedirs(os.path.join(path, s), exist_ok=True)
        console.print(f"📂 Opening Project Export: {format_path(path)}")
        os.startfile(path)
    else:
        console.print(f"📂 Opening Month Export: {format_path(month_path)}")
        os.startfile(month_path)

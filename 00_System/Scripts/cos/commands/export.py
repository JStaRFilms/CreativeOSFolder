"""Export command."""

import os
import argparse
from typing import Any

from ..console import console
from ..file_utils import get_export_month_path, find_meta_in_cwd, format_path

def add_parser(subparsers: Any) -> None:
    p_exp = subparsers.add_parser("export", help="Open export location")
    p_exp.add_argument("-s", "--simple", action="store_true")

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

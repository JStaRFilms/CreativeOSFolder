"""Sort exports command."""

import os
import argparse
import datetime
import shutil
from typing import Any

from ..console import console
from ..config import EXPORTS_PATH
from ..file_utils import get_smart_date, format_path

def add_parser(subparsers: Any) -> None:
    subparsers.add_parser("sort-exports", help="Sort Inbox")

def cmd_sort_exports(args: argparse.Namespace) -> None:
    """File items from the global Export _Inbox into correct Year/Month folders."""
    inbox_path = os.path.join(EXPORTS_PATH, "_Inbox")
    if not os.path.exists(inbox_path):
        os.makedirs(inbox_path)
        console.print(f"[success]✨ Created Inbox at: {inbox_path}[/success]")
        os.startfile(inbox_path)
        return
        
    console.print(f"🗂️  Sorting Inbox: {format_path(inbox_path)}...")
    
    if not os.listdir(inbox_path):
        console.print("[success]✅ Inbox is empty.[/success]")
        return
    
    count = 0
    for item in os.listdir(inbox_path):
        src_path = os.path.join(inbox_path, item)
        smart_ts = get_smart_date(src_path)
        date_obj = datetime.datetime.fromtimestamp(smart_ts)
        year = date_obj.strftime("%Y")
        month_folder = date_obj.strftime("%m - %B")
        
        dest_dir = os.path.join(EXPORTS_PATH, year, month_folder)
        if os.path.isdir(src_path): dest_path = os.path.join(dest_dir, item)
        else: dest_path = os.path.join(dest_dir, item)
        
        parent_dir = os.path.dirname(dest_path)
        if not os.path.exists(parent_dir): os.makedirs(parent_dir)
        
        base, ext = os.path.splitext(dest_path)
        counter = 2
        while os.path.exists(dest_path):
            dest_path = f"{base}_v{counter}{ext}"
            counter += 1
            
        try:
            shutil.move(src_path, dest_path)
            count += 1
            console.print(f"  -> Filed: {item} into [cyan]{year}/{month_folder}[/cyan]")
        except Exception as e: console.print(f"  [error]❌ Error: {e}[/error]")
    
    console.print(f"[success]✨ Sorted {count} items.[/success]")

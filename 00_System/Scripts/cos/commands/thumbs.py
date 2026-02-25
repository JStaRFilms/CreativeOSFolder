"""Thumbs command."""

import os
import argparse
import datetime
import shutil
import json
from typing import Any

from ..console import console
from ..config import PROJECTS_PATH, ROOT_PATH

def add_parser(subparsers: Any) -> None:
    subparsers.add_parser("thumbs", help="Update Gallery")

def cmd_thumbs(args: argparse.Namespace) -> None:
    """Update the Global Thumbnail Mirror by scanning all projects."""
    console.print("[bold purple]🖼️  Spinning up Thumbnail Mirror...[/bold purple]")
    gallery_root = os.path.join(ROOT_PATH, "04_Global_Assets", "Thumbnails_Mirror")
    if not os.path.exists(gallery_root): os.makedirs(gallery_root)
    
    count = 0
    with console.status("Mirroring..."):
        for root, dirs, files in os.walk(PROJECTS_PATH):
            if "02_Assets" in dirs:
                thumb_source = os.path.join(root, "02_Assets", "Thumbnails")
                if os.path.exists(thumb_source):
                    project_name = os.path.basename(root)
                    if ".project_meta.json" in files:
                        try:
                            with open(os.path.join(root, ".project_meta.json"), "r", encoding="utf-8-sig") as f:
                                meta = json.load(f)
                                project_name = meta.get("slug", project_name)
                        except: pass
                    
                    for img in os.listdir(thumb_source):
                        if img.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                            src_file = os.path.join(thumb_source, img)
                            ts = os.path.getmtime(src_file)
                            date_str = datetime.datetime.fromtimestamp(ts).strftime("%Y-%m-%d")
                            new_name = f"{date_str}_{project_name}_{img}"
                            dst_file = os.path.join(gallery_root, new_name)
                            if not os.path.exists(dst_file):
                                shutil.copy2(src_file, dst_file)
                                count += 1
                                console.print(f"  -> Mirrored: [cyan]{new_name}[/cyan]")
    
    console.print(f"[success]✨ Gallery Updated. {count} new thumbnails.[/success]")
    os.startfile(gallery_root)

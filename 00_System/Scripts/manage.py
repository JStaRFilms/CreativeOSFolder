import os
import json
import argparse
import datetime
import sys
import shutil
import statistics
import filecmp
import time
import stat
import subprocess
from argparse import RawTextHelpFormatter

# --- RICH IMPORTS ---
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.markdown import Markdown
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeRemainingColumn
from rich.prompt import Prompt, Confirm, IntPrompt
from rich.theme import Theme
from rich import box

# --- RICH SETUP ---
custom_theme = Theme({
    "info": "cyan",
    "warning": "yellow",
    "error": "bold red",
    "success": "bold green",
    "project": "bold purple",
    "path": "blue underline"
})
console = Console(theme=custom_theme)

# --- CONFIG LOAD ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(SCRIPT_DIR, "..", "Config", "config.json")

if not os.path.exists(CONFIG_PATH):
    console.print("❌ [error]CRITICAL ERROR: Config file not found.[/error]")
    sys.exit(1)

with open(CONFIG_PATH, "r") as f:
    CONFIG = json.load(f)

ROOT_PATH = CONFIG["root_path"]
PROJECTS_PATH = CONFIG["projects_path"]
EXPORTS_PATH = CONFIG["exports_path"]
TEMPLATES_PATH = CONFIG["templates_path"]
VAULT_PATH = CONFIG["vault_path"]
DOWNLOADS_PATH = CONFIG.get("downloads_path", os.path.join(os.path.expanduser("~"), "Downloads"))
SHUTTLE_PATH = CONFIG.get("shuttle_path", "A:\\CreativeOS_Shuttle")
ARCHIVE_PATH = CONFIG.get("archive_path", "D:\\OneDrive - Developer\\Archive")

# --- HELPERS ---

def get_date_slug(override_date=None):
    if override_date: return override_date
    return datetime.datetime.now().strftime("%Y-%m-%d")

def get_export_month_path():
    now = datetime.datetime.now()
    year = now.strftime("%Y")
    month_name = now.strftime("%B")
    month_num = now.strftime("%m")
    
    full_path = os.path.join(EXPORTS_PATH, year, f"{month_num} - {month_name}")
    if not os.path.exists(full_path): os.makedirs(full_path)
    return full_path

def find_meta_in_cwd():
    current = os.getcwd()
    for _ in range(3):
        if ".project_meta.json" in os.listdir(current):
            try:
                with open(os.path.join(current, ".project_meta.json"), "r", encoding="utf-8-sig") as f:
                    return json.load(f), current
            except: return None, None
        current = os.path.dirname(current)
        if len(current) < 4: break
    return None, None

def get_smart_date(path):
    if os.path.isfile(path): return os.path.getmtime(path)
    timestamps = []
    for root, _, files in os.walk(path):
        for file in files:
            if not file.startswith('.'):
                try: timestamps.append(os.path.getmtime(os.path.join(root, file)))
                except: pass
    if not timestamps: return os.path.getmtime(path)
    return statistics.median(timestamps)

def sync_two_folders(dir_a, dir_b):
    """Bidirectional Sync: A (Project) <-> B (Vault)"""
    if not os.path.exists(dir_a): os.makedirs(dir_a)
    if not os.path.exists(dir_b): os.makedirs(dir_b)

    files_a = set(f for f in os.listdir(dir_a) if f.endswith(".md"))
    files_b = set(f for f in os.listdir(dir_b) if f.endswith(".md"))
    all_files = files_a.union(files_b)
    logs = []

    for filename in all_files:
        path_a = os.path.join(dir_a, filename)
        path_b = os.path.join(dir_b, filename)

        # Case 1: New in A
        if filename in files_a and filename not in files_b:
            try:
                shutil.copy2(path_a, path_b)
                logs.append({"type": "push", "file": filename, "msg": "Pushed to Vault"})
            except Exception as e: logs.append({"type": "error", "file": filename, "msg": str(e)})

        # Case 2: New in B
        elif filename in files_b and filename not in files_a:
            try:
                shutil.copy2(path_b, path_a)
                logs.append({"type": "pull", "file": filename, "msg": "Pulled from Vault"})
            except Exception as e: logs.append({"type": "error", "file": filename, "msg": str(e)})

        # Case 3: Conflict
        else:
            try:
                if not filecmp.cmp(path_a, path_b, shallow=False):
                    mtime_a = os.path.getmtime(path_a)
                    mtime_b = os.path.getmtime(path_b)
                    
                    if mtime_a > mtime_b:
                        shutil.copy2(path_a, path_b)
                        logs.append({"type": "update_vault", "file": filename, "msg": "Updated Vault"})
                    elif mtime_b > mtime_a:
                        # Create safety backup
                        shutil.copy2(path_a, path_a + ".bak")
                        shutil.copy2(path_b, path_a)
                        logs.append({"type": "update_project", "file": filename, "msg": "Updated Project (Backup made)"})
                    else:
                        # Timestamps equal but content differs. Force push to Vault to resolve.
                        shutil.copy2(path_a, path_b)
                        logs.append({"type": "conflict", "file": filename, "msg": "Content mismatch. Forced Push."})
            except Exception as e: logs.append({"type": "error", "file": filename, "msg": str(e)})
    
    return logs

def copy_with_progress(src, dst):
    """Copies files from src to dst, showing a rich progress bar."""
    os.makedirs(dst, exist_ok=True)
    
    all_files = []
    for root, _, files in os.walk(src):
        for name in files:
            all_files.append(os.path.join(root, name))

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TimeRemainingColumn(),
        console=console
    ) as progress:
        task = progress.add_task(f"[cyan]Copying {len(all_files)} files...", total=len(all_files))
        
        for f in all_files:
            rel_path = os.path.relpath(f, src)
            dest_file_path = os.path.join(dst, rel_path)
            
            os.makedirs(os.path.dirname(dest_file_path), exist_ok=True)
            shutil.copy2(f, dest_file_path)
            progress.advance(task)

def setup_git(project_path, category):
    """Initializes Git and adds .gitignore."""
    console.print("   [info]🔧 Initializing Git Repository...[/info]")
    
    # 1. Run git init
    try:
        subprocess.run(["git", "init"], cwd=project_path, check=True, stdout=subprocess.DEVNULL)
    except FileNotFoundError:
        console.print("   [warning]⚠️  Git is not installed or not in PATH. Skipping.[/warning]")
        return
    except Exception as e:
        console.print(f"   [error]❌ Git init failed: {e}[/error]")
        return

    # 2. Copy .gitignore
    gitignore_src = os.path.join(TEMPLATES_PATH, "universal.gitignore")
    gitignore_dest = os.path.join(project_path, ".gitignore")
    
    if os.path.exists(gitignore_src):
        shutil.copy2(gitignore_src, gitignore_dest)
    else:
        with open(gitignore_dest, "w") as f:
            f.write("# CreativeOS Auto-Gitignore\nnode_modules/\n__pycache__/\n.env\n")

    console.print("   [success]✅ Git initialized & .gitignore added.[/success]")

    # 3. Initial Commit
    if Confirm.ask("Perform initial git commit now?"):
        try:
            with console.status("[bold cyan]Committing...[/bold cyan]"):
                subprocess.run(["git", "add", "."], cwd=project_path, check=True, stdout=subprocess.DEVNULL)
                subprocess.run(["git", "commit", "-m", "Initial commit via CreativeOS Genesis"], cwd=project_path, check=True, stdout=subprocess.DEVNULL)
            console.print("   [success]✅ Initial commit performed.[/success]")
        except Exception as e:
            console.print(f"   [error]❌ Initial commit failed: {e}[/error]")

# --- COMMANDS ---

def cmd_new(args):
    project_name = args.name
    category = args.category.title()
    date_prefix = get_date_slug(args.date)
    safe_name = project_name.replace(" ", "_")
    slug = f"{date_prefix}_{safe_name}"

    cwd = os.getcwd()
    target_root = None
    
    # Logic to determine root
    if args.client:
        target_root = os.path.join(PROJECTS_PATH, "Clients", args.client)
        if not os.path.exists(target_root):
            os.makedirs(target_root)
            console.print(f"[success]✨ Created new Client folder: {args.client}[/success]")
    elif cwd.startswith(PROJECTS_PATH):
        target_root = cwd
    else:
        if category.lower() in ["web", "code"]: phys_cat = "Code"
        elif category.lower() in ["music", "audio"]: phys_cat = "Music"
        elif category.lower() == "ai": phys_cat = "AI"
        else: phys_cat = "Video"
        target_root = os.path.join(PROJECTS_PATH, phys_cat)

    target_dir = os.path.join(target_root, slug)
    
    # -- PRE-FLIGHT CHECK ---
    info_table = Table(show_header=False, box=box.SIMPLE)
    info_table.add_row("Project Name", f"[project]{project_name}[/project]")
    info_table.add_row("Slug", slug)
    info_table.add_row("Category", category)
    info_table.add_row("Location", f"[path]{target_dir}[/path]")
    if args.client: info_table.add_row("Client", args.client)
    
    console.print(Panel(info_table, title="🚀 Launching New Project", border_style="purple"))

    if os.path.exists(target_dir):
        console.print(f"[warning]⚠️  Project already exists: {target_dir}[/warning]")
        return

    # Template Logic
    cat_lower = category.lower()
    if args.simple: template_name = "simple"
    elif cat_lower == "code": template_name = "plain_code"
    elif cat_lower == "web": template_name = "code_project"
    elif cat_lower in ["music", "audio"]: template_name = "audio_project"
    elif cat_lower == "ai": template_name = "ai_project"
    else: template_name = "video_project"

    template_file = os.path.join(TEMPLATES_PATH, template_name, "structure.json")
    if not os.path.exists(template_file):
        console.print(f"[error]❌ Template not found: {template_name}[/error]")
        return

    with open(template_file, "r") as f: structure = json.load(f)

    with console.status(f"[bold cyan]Construction in progress ({template_name})...[/bold cyan]"):
        os.makedirs(target_dir)

        meta_client = "None"
        if args.client: meta_client = args.client
        else:
            norm_path = target_root.replace("\\", "/")
            parts = norm_path.split("/")
            if "Clients" in parts:
                try: meta_client = parts[parts.index("Clients") + 1]
                except: pass
            elif "Video" in parts:
                 try:
                     if len(parts) > parts.index("Video") + 1: meta_client = parts[parts.index("Video") + 1]
                 except: pass

        for folder, contents in structure.items():
            folder_path = os.path.join(target_dir, folder)
            os.makedirs(folder_path, exist_ok=True)
            for item in contents:
                if "." in item:
                    if not os.path.exists(os.path.join(folder_path, item)):
                        with open(os.path.join(folder_path, item), "w") as f:
                            f.write(f"# {item}\nProject: {project_name}\nCreated: {date_prefix}\n")
                else: os.makedirs(os.path.join(folder_path, item), exist_ok=True)

        notes_dir = os.path.join(target_dir, "00_Notes")
        os.makedirs(notes_dir, exist_ok=True)
        with open(os.path.join(notes_dir, "Idea.md"), "w") as f:
            f.write(f"""---
type: project
category: {category}
client: {meta_client}
status: active
created: {date_prefix}
tags: [creativeos]
---

# {project_name}
""")

        meta = {
            "name": project_name, "slug": slug, "type": category,
            "created": date_prefix, "client": meta_client,
            "template": template_name, "root": target_dir
        }
        with open(os.path.join(target_dir, ".project_meta.json"), "w") as f:
            json.dump(meta, f, indent=4)
        
        # Git Setup
        if args.git:
            setup_git(target_dir, category)
    
    console.print(Panel(f"Project successfully spawned at:\n[path]{target_dir}[/path]", style="bold green", title="✅ Success"))

def cmd_init(args):
    cwd = os.getcwd()
    if not cwd.startswith(PROJECTS_PATH):
        console.print("[warning]⚠️  Not in CreativeOS Projects folder.[/warning]")
        if not Confirm.ask("Proceed anyway?"): return

    if os.path.exists(os.path.join(cwd, ".project_meta.json")):
        console.print("[success]✅ Already initialized.[/success]")
        return

    console.rule("[bold purple]Project Adoption")
    
    with console.status("[cyan]Scanning Directory Context...[/cyan]"):
        smart_ts = get_smart_date(cwd)
        date_str = datetime.datetime.fromtimestamp(smart_ts).strftime("%Y-%m-%d")
        
        current_name = os.path.basename(cwd)
        norm_path = cwd.replace("\\", "/")
        parts = norm_path.split("/")
        
        meta_client = "None"
        category = "Video"
        if "Clients" in parts:
            try: meta_client = parts[parts.index("Clients") + 1]
            except: pass
        elif "Video" in parts:
            try: 
                if len(parts) > parts.index("Video") + 2: meta_client = parts[parts.index("Video") + 1]
            except: pass
        
        if "Code" in parts: category = "Code"
        elif "Music" in parts: category = "Music"
        elif "AI" in parts: category = "AI"

        time.sleep(0.5) # UX Pause

    # Display Inferred Data
    table = Table(title="Inferred Metadata", box=box.ROUNDED)
    table.add_column("Key", style="cyan")
    table.add_column("Value", style="white")
    table.add_row("Name", current_name)
    table.add_row("Category", category)
    table.add_row("Client", meta_client)
    table.add_row("Date", date_str)
    console.print(table)

    notes_dir = os.path.join(cwd, "00_Notes")
    os.makedirs(notes_dir, exist_ok=True)
    if not os.path.exists(os.path.join(notes_dir, "Idea.md")):
        with open(os.path.join(notes_dir, "Idea.md"), "w") as f:
            f.write(f"""---
type: project
category: {category}
client: {meta_client}
status: active
created: {date_str}
tags: [creativeos]
---

# {current_name}
""")

    slug = f"{date_str}_{current_name.replace(' ', '_')}"
    meta = {
        "name": current_name, "slug": slug, "type": category,
        "created": date_str, "client": meta_client,
        "template": "adopted_existing", "root": cwd
    }
    with open(os.path.join(cwd, ".project_meta.json"), "w") as f:
        json.dump(meta, f, indent=4)
        
    console.print(Panel(f"Project adopted! Slug: [bold]{slug}[/bold]", style="success"))

def cmd_export(args):
    month_path = get_export_month_path()
    meta, project_root = find_meta_in_cwd()
    
    if meta and not args.simple:
        path = os.path.join(month_path, meta["slug"])
        for s in ["Video", "Thumbnail", "Audio"]: os.makedirs(os.path.join(path, s), exist_ok=True)
        console.print(f"📂 Opening Project Export: [path]{path}[/path]")
        os.startfile(path)
    else:
        console.print(f"📂 Opening Month Export: [path]{month_path}[/path]")
        os.startfile(month_path)

def cmd_sync(args):
    console.rule("[bold purple]Syncing CreativeOS Brain")
    vault_projects_dir = os.path.join(VAULT_PATH, "01_Active_Projects")
    if not os.path.exists(vault_projects_dir): os.makedirs(vault_projects_dir)

    changes_table = Table(show_header=True, header_style="bold magenta", box=box.SIMPLE)
    changes_table.add_column("Project", style="cyan")
    changes_table.add_column("Action", style="white")
    changes_table.add_column("File", style="dim")

    total_changes = 0
    
    with console.status("[bold cyan]Syncing Notes...[/bold cyan]"):
        for root, dirs, files in os.walk(PROJECTS_PATH):
            if ".project_meta.json" in files:
                meta_path = os.path.join(root, ".project_meta.json")
                try:
                    with open(meta_path, "r", encoding="utf-8-sig") as f: meta = json.load(f)
                except: continue
                
                project_name = meta.get("slug", "Unknown")
                notes_project = os.path.join(root, "00_Notes")
                notes_vault = os.path.join(vault_projects_dir, project_name)

                logs = sync_two_folders(notes_project, notes_vault)
                
                for log in logs:
                    symbol = "✅"
                    if log["type"] == "push": symbol = "→ [green]Push[/green]"
                    elif log["type"] == "pull": symbol = "← [blue]Pull[/blue]"
                    elif log["type"] == "error": symbol = "❌ [red]Error[/red]"
                    elif log["type"] == "conflict": symbol = "⚠️ [yellow]Conflict[/yellow]"
                    
                    changes_table.add_row(project_name, symbol, log["file"])
                    total_changes += 1

    if total_changes == 0:
        console.print("[success]✅ Everything is up to date.[/success]")
    else:
        console.print(changes_table)
        console.print(f"[success]✨ Sync Complete. {total_changes} operations.[/success]")

def cmd_thumbs(args):
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

def cmd_clone(args):
    """Clones a Git repo and adopts it into CreativeOS."""
    url = args.url
    
    # 1. Determine Project Name from URL if not provided
    if not args.name:
        base_name = url.rstrip("/").split("/")[-1]
        if base_name.endswith(".git"):
            base_name = base_name[:-4]
        project_name = base_name
    else:
        project_name = args.name

    category = args.category.title()
    if category == "Video" and not args.category_flag_passed:
        category = "Code"

    date_prefix = get_date_slug(args.date)
    safe_name = project_name.replace(" ", "_")
    slug = f"{date_prefix}_{safe_name}"

    # 3. Location Logic
    cwd = os.getcwd()
    if args.client:
        target_root = os.path.join(PROJECTS_PATH, "Clients", args.client)
        if not os.path.exists(target_root):
            os.makedirs(target_root)
            console.print(f"[success]✨ Created new Client folder: {args.client}[/success]")
    elif cwd.startswith(PROJECTS_PATH):
        target_root = cwd
    else:
        if category.lower() in ["web", "code"]: phys_cat = "Code"
        elif category.lower() in ["music", "audio"]: phys_cat = "Music"
        elif category.lower() == "ai": phys_cat = "AI"
        else: phys_cat = "Video"
        target_root = os.path.join(PROJECTS_PATH, phys_cat)

    target_dir = os.path.join(target_root, slug)
    
    if os.path.exists(target_dir):
        console.print(f"[warning]⚠️  Target directory already exists: {target_dir}[/warning]")
        return

    # Info Panel
    info_table = Table(show_header=False, box=box.SIMPLE)
    info_table.add_row("Source", url)
    info_table.add_row("Destination", f"[path]{target_dir}[/path]")
    console.print(Panel(info_table, title="⬇️  Cloning Repository", border_style="cyan"))

    # 4. Perform Git Clone
    try:
        with console.status("[bold cyan]Cloning...[/bold cyan]"):
            subprocess.run(["git", "clone", url, target_dir], check=True)
    except Exception as e:
        console.print(f"[error]❌ Git Clone failed: {e}[/error]")
        return

    # 5. Bless the Project (Metadata + Notes)
    console.print("🪄  Blessing project with CreativeOS metadata...")
    
    notes_dir = os.path.join(target_dir, "00_Notes")
    os.makedirs(notes_dir, exist_ok=True)
    if not os.path.exists(os.path.join(notes_dir, "Idea.md")):
        with open(os.path.join(notes_dir, "Idea.md"), "w") as f:
            f.write(f"# {project_name}\nType: Cloned Repository\nSource: {url}\nDate: {date_prefix}\n")

    meta_client = "None"
    if args.client: meta_client = args.client
    else:
        norm_path = target_root.replace("\\", "/")
        parts = norm_path.split("/")
        if "Clients" in parts:
            try: meta_client = parts[parts.index("Clients") + 1]
            except: pass

    meta = {
        "name": project_name, "slug": slug, "type": category,
        "created": date_prefix, "client": meta_client,
        "template": "git_clone", "repo_url": url, "root": target_dir
    }
    with open(os.path.join(target_dir, ".project_meta.json"), "w") as f:
        json.dump(meta, f, indent=4)

    console.print(Panel(f"Clone Complete!\n[path]{target_dir}[/path]", style="success"))

def cmd_clean(args):
    target_path = args.target if args.target else DOWNLOADS_PATH

    console.print(f"[bold cyan]🧹 Cleaning: [path]{target_path}[/path]...[/bold cyan]")
    if not os.path.exists(target_path):
        console.print(f"[error]❌ Error: Path not found: {target_path}[/error]")
        return

    MAPPING = {
        "_Images": [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".tiff", ".bmp"],
        "_Video": [".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".wmv"],
        "_Audio": [".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a"],
        "_Docs": [".pdf", ".docx", ".txt", ".xlsx", ".pptx", ".csv", ".md"],
        "_Installers": [".exe", ".msi", ".iso", ".dmg"],
        "_Archives": [".zip", ".rar", ".7z", ".tar", ".gz"],
        "_Fonts": [".ttf", ".otf", ".woff", ".woff2"],
        "_3D": [".blend", ".fbx", ".obj", ".stl", ".gltf"]
    }

    results_table = Table(title="Cleanup Summary", box=box.SIMPLE)
    results_table.add_column("File", style="white")
    results_table.add_column("Moved To", style="cyan")

    count = 0
    for item in os.listdir(target_path):
        if item.startswith("."): continue 

        item_path = os.path.join(target_path, item)

        if os.path.isfile(item_path):
            ext = os.path.splitext(item)[1].lower()
            target_folder = None

            for folder, extensions in MAPPING.items():
                if ext in extensions:
                    target_folder = folder
                    break

            if not target_folder:
                target_folder = "_Other"

            if target_folder:
                dest_dir = os.path.join(target_path, target_folder)
                if not os.path.exists(dest_dir): os.makedirs(dest_dir)

                try:
                    shutil.move(item_path, os.path.join(dest_dir, item))
                    count += 1
                    results_table.add_row(item, target_folder)
                except Exception as e:
                    console.print(f"[error]⚠️ Could not move {item}: {e}[/error]")

    if count > 0:
        console.print(results_table)
        console.print(f"[success]✨ Cleanup Complete. {count} files moved.[/success]")
    else:
        console.print("[info]No files needed moving.[/info]")

    os.startfile(target_path)

def cmd_sort_exports(args):
    inbox_path = os.path.join(EXPORTS_PATH, "_Inbox")
    if not os.path.exists(inbox_path):
        os.makedirs(inbox_path)
        console.print(f"[success]✨ Created Inbox at: {inbox_path}[/success]")
        os.startfile(inbox_path)
        return
        
    console.print(f"🗂️  Sorting Inbox: [path]{inbox_path}[/path]...")
    
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

def cmd_travel(args):
    """Copies the current project to the External Shuttle Drive."""
    meta, project_root = find_meta_in_cwd()
    
    if not meta:
        console.print("[error]❌ Error: You must be inside an initialized project to use 'travel'.[/error]")
        return

    console.rule(f"[bold purple]🚀 Shuttle Launch: {meta['name']}")
    
    if not os.path.exists(SHUTTLE_PATH):
        console.print(f"[error]❌ Error: Shuttle Drive not found at: {SHUTTLE_PATH}[/error]")
        console.print("   (Check your config.json or plug in the drive)")
        return

    rel_path = os.path.relpath(project_root, PROJECTS_PATH)
    dest_path = os.path.join(SHUTTLE_PATH, "Projects", rel_path)

    console.print(f"Source: [path]{project_root}[/path]")
    console.print(f"Target: [path]{dest_path}[/path]")
    
    if not Confirm.ask("Start copy? This might take a while for video."): return

    try:
        copy_with_progress(project_root, dest_path)
        
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(os.path.join(dest_path, "_TRAVEL_LOG.txt"), "a") as f:
            f.write(f"Synced from Desktop at: {timestamp}\n")
            
        console.print(Panel(f"Project ready for travel!\n[path]{dest_path}[/path]", title="✅ Launch Successful", style="success"))
        console.print("   [info]Don't forget to Eject safely.[/info]")
        os.startfile(dest_path)
        
    except Exception as e:
        console.print(f"[error]❌ Copy failed: {e}[/error]")

def remove_readonly(func, path, excinfo):
    os.chmod(path, stat.S_IWRITE)
    func(path)

def robust_rmtree(path, retries=5, delay=1):
    for i in range(retries):
        try:
            shutil.rmtree(path, onerror=remove_readonly)
            return True
        except OSError as e:
            console.print(f"[warning]Attempt {i+1}/{retries}: Failed to remove {path}. Retrying in {delay}s...[/warning]")
            time.sleep(delay)
    console.print(f"[error]❌ Failed to remove directory after {retries} retries: {path}[/error]")
    return False

def cmd_resurrect(args):
    """Brings a project back from the dead (Archive -> Active)."""
    search_term = args.name.lower()
    console.print(f"🔎 Searching Archive for: '[cyan]{args.name}[/cyan]'...")
    
    if not os.path.exists(ARCHIVE_PATH):
        console.print(f"[error]Error: Archive path not found: {ARCHIVE_PATH}[/error]")
        return

    # 1. Search for matching folders
    matches = []
    with console.status("Scanning Archive..."):
        for root, dirs, files in os.walk(ARCHIVE_PATH):
            for d in dirs:
                if search_term in d.lower():
                    matches.append(os.path.join(root, d))
            if root.count(os.sep) - ARCHIVE_PATH.count(os.sep) > 1:
                del dirs[:]

    if not matches:
        console.print("[warning]No matching projects found in Archive.[/warning]")
        return

    # 2. Select Project
    selected_path = matches[0]
    if len(matches) > 1:
        console.print("[bold]Multiple matches found:[/bold]")
        for i, m in enumerate(matches):
            console.print(f"   [green]{i+1}.[/green] {m}")
        
        choice = IntPrompt.ask("Select project number", choices=[str(i+1) for i in range(len(matches))])
        selected_path = matches[int(choice) - 1]

    project_name = os.path.basename(selected_path)
    console.print(f"✨ Resurrecting: [bold]{project_name}[/bold]")

    # 3. Determine Destination
    category = "Video" # Default
    meta_path = os.path.join(selected_path, ".project_meta.json")
    
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8-sig") as f:
                meta = json.load(f)
                category = meta.get("type", "Video")
                if meta.get("client") and meta.get("client") != "None":
                    dest_root = os.path.join(PROJECTS_PATH, "Clients", meta["client"])
                else:
                    if category.lower() in ["web", "code"]: dest_cat = "Code"
                    elif category.lower() in ["music", "audio"]: dest_cat = "Music"
                    elif category.lower() == "ai": dest_cat = "AI"
                    else: dest_cat = "Video"
                    dest_root = os.path.join(PROJECTS_PATH, dest_cat)
        except:
            dest_root = os.path.join(PROJECTS_PATH, "Video")
    else:
        dest_root = os.path.join(PROJECTS_PATH, "Video")

    if not os.path.exists(dest_root): os.makedirs(dest_root)
    final_dest = os.path.join(dest_root, project_name)

    if os.path.exists(final_dest):
        console.print(f"[warning]Warning: Project already exists in Active Projects: {final_dest}[/warning]")
        return

    try:
        copy_with_progress(selected_path, final_dest)
        
        console.print("removing from archive...")
        if robust_rmtree(selected_path):
            console.print(Panel(f"Project moved to:\n[path]{final_dest}[/path]", title="✨ LIVE!", style="success"))
            os.startfile(final_dest)
        else:
             console.print(f"[warning]❌ Could not remove from archive. Copied safely to Active.[/warning]")
    except Exception as e:
        console.print(f"[error]❌ An unexpected error occurred: {e}[/error]")

# --- MAIN ---

def main():
    banner = """
    ______                _   _            ___  ____
   / ____/________  ____ | | | |__   ___  / _ \/ ___|
  | |   | '__/ _ \/ _` || |_| |\ \ / / _ \| | | \___ \\
  | |___| | |  __/ (_| ||  _  | \ V /  __/ |_| |___) |
   \____|_|  \___|\__,_||_| |_|  \_/ \___|\___/|____/
    """
    
    # We do a custom help print because argparse help is ugly compared to Rich
    if len(sys.argv) == 1:
        console.print(Panel.fit(f"[bold purple]{banner}[/bold purple]", title="CreativeOS CLI", border_style="purple"))
        
        table = Table(box=box.SIMPLE, show_header=False)
        table.add_column("Command", style="cyan bold")
        table.add_column("Description", style="white")
        
        table.add_row("", "[bold underline]CREATION[/bold underline]")
        table.add_row("new <name>", "Create fresh project")
        table.add_row("clone <url>", "Clone Git repo & adopt into OS")
        table.add_row("init", "Adopt current folder")
        table.add_row("", "")
        table.add_row("", "[bold underline]MAINTENANCE[/bold underline]")
        table.add_row("sync", "Sync Notes <-> Obsidian")
        table.add_row("export", "Open Export Folder")
        table.add_row("thumbs", "Update Thumbnail Gallery")
        table.add_row("clean", "Sort Downloads")
        table.add_row("travel", "Copy to Shuttle Drive")
        table.add_row("resurrect", "Restore from Archive")
        
        console.print(table)
        console.print("\nUse [bold]cos <command> -h[/bold] for flags.")
        sys.exit(0)

    help_text = "CreativeOS CLI" # Placeholder for argparse

    parser = argparse.ArgumentParser(description=help_text, formatter_class=RawTextHelpFormatter)
    subparsers = parser.add_subparsers(dest="command", title="Commands")

    # --- NEW ---
    p_new = subparsers.add_parser("new", help="Spawn a new project")
    p_new.add_argument("name", type=str)
    p_new.add_argument("-c", "--category", type=str, default="Video")
    p_new.add_argument("-s", "--simple", action="store_true")
    p_new.add_argument("-d", "--date", type=str)
    p_new.add_argument("--client", type=str)
    p_new.add_argument("-g", "--git", action="store_true")

    # --- CLONE ---
    p_clone = subparsers.add_parser("clone", help="Clone a repo into CreativeOS")
    p_clone.add_argument("url", type=str)
    p_clone.add_argument("-n", "--name", type=str)
    p_clone.add_argument("-c", "--category", type=str, default="Video")
    p_clone.add_argument("-d", "--date", type=str)
    p_clone.add_argument("--client", type=str)

    # --- INIT ---
    subparsers.add_parser("init", help="Adopt current folder")

    # --- EXPORT ---
    p_exp = subparsers.add_parser("export", help="Open export location")
    p_exp.add_argument("-s", "--simple", action="store_true")

    # --- UTILS ---
    subparsers.add_parser("sync", help="Sync Notes")
    subparsers.add_parser("thumbs", help="Update Gallery")
    subparsers.add_parser("clean", help="Sort Downloads")
    subparsers.add_parser("sort-exports", help="Sort Inbox")
    subparsers.add_parser("travel", help="Copy to Shuttle")
    
    # --- RESURRECT ---
    subparsers.add_parser("resurrect", help="Restore from Archive").add_argument("name", type=str)

    args = parser.parse_args()

    args.category_flag_passed = "-c" in sys.argv or "--category" in sys.argv

    if args.command == "new": cmd_new(args)
    elif args.command == "clone": cmd_clone(args)
    elif args.command == "init": cmd_init(args)
    elif args.command == "export": cmd_export(args)
    elif args.command == "sync": cmd_sync(args)
    elif args.command == "thumbs": cmd_thumbs(args)
    elif args.command == "clean": cmd_clean(args)
    elif args.command == "sort-exports": cmd_sort_exports(args)
    elif args.command == "travel": cmd_travel(args)
    elif args.command == "resurrect": cmd_resurrect(args)
    else: parser.print_help()

if __name__ == "__main__":
    main()
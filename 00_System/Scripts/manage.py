import os
import json
import argparse
import datetime
import sys
import shutil
import statistics
import filecmp
from argparse import RawTextHelpFormatter

# --- CONFIG LOAD ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(SCRIPT_DIR, "..", "Config", "config.json")

if not os.path.exists(CONFIG_PATH):
    print("❌ CRITICAL ERROR: Config file not found.")
    sys.exit(1)

with open(CONFIG_PATH, "r") as f:
    CONFIG = json.load(f)

ROOT_PATH = CONFIG["root_path"]
PROJECTS_PATH = CONFIG["projects_path"]
EXPORTS_PATH = CONFIG["exports_path"]
TEMPLATES_PATH = CONFIG["templates_path"]
VAULT_PATH = CONFIG["vault_path"]
DOWNLOADS_PATH = CONFIG.get("downloads_path", os.path.join(os.path.expanduser("~"), "Downloads"))

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
                logs.append(f"  [→] Pushed to Vault: {filename}")
            except Exception as e: logs.append(f"  ❌ Error pushing {filename}: {e}")

        # Case 2: New in B
        elif filename in files_b and filename not in files_a:
            try:
                shutil.copy2(path_b, path_a)
                logs.append(f"  [←] Pulled from Vault: {filename}")
            except Exception as e: logs.append(f"  ❌ Error pulling {filename}: {e}")

        # Case 3: Conflict
        else:
            try:
                if not filecmp.cmp(path_a, path_b, shallow=False):
                    mtime_a = os.path.getmtime(path_a)
                    mtime_b = os.path.getmtime(path_b)
                    
                    if mtime_a > mtime_b:
                        shutil.copy2(path_a, path_b)
                        logs.append(f"  [→] Updated Vault: {filename}")
                    elif mtime_b > mtime_a:
                        # Create safety backup
                        shutil.copy2(path_a, path_a + ".bak")
                        shutil.copy2(path_b, path_a)
                        logs.append(f"  [←] Updated Project (Backup made): {filename}")
                    else:
                        # Timestamps equal but content differs. Force push to Vault to resolve.
                        shutil.copy2(path_a, path_b)
                        logs.append(f"  [→] Content mismatch (timestamps equal). Pushed Project: {filename}")
            except Exception as e: logs.append(f"  ❌ Error syncing {filename}: {e}")
    
    return logs

# --- COMMANDS ---

def cmd_new(args):
    project_name = args.name
    category = args.category.title()
    date_prefix = get_date_slug(args.date)
    safe_name = project_name.replace(" ", "_")
    slug = f"{date_prefix}_{safe_name}"
    
    cwd = os.getcwd()
    if args.client:
        target_root = os.path.join(PROJECTS_PATH, "Clients", args.client)
        if not os.path.exists(target_root):
            os.makedirs(target_root)
            print(f"✨ Created new Client folder: {args.client}")
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
        print(f"⚠️  Project already exists: {target_dir}")
        return

    # Template Logic (THE FIX IS HERE)
    cat_lower = category.lower()
    if args.simple: template_name = "simple"
    elif cat_lower == "code": template_name = "plain_code"
    elif cat_lower == "web": template_name = "code_project"
    elif cat_lower in ["music", "audio"]: template_name = "audio_project"
    elif cat_lower == "ai": template_name = "ai_project"  # <--- ADDED THIS LINE
    else: template_name = "video_project"
    
    template_file = os.path.join(TEMPLATES_PATH, template_name, "structure.json")
    if not os.path.exists(template_file):
        print(f"❌ Template not found: {template_name}")
        return
        
    with open(template_file, "r") as f: structure = json.load(f)

    print(f"🔨 Creating project: {slug}")
    os.makedirs(target_dir)
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
    if not os.path.exists(os.path.join(notes_dir, "Idea.md")):
        with open(os.path.join(notes_dir, "Idea.md"), "w") as f:
            f.write(f"# {project_name}\nDate: {date_prefix}\n")

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

    meta = {
        "name": project_name, "slug": slug, "type": category,
        "created": date_prefix, "client": meta_client,
        "template": template_name, "root": target_dir
    }
    with open(os.path.join(target_dir, ".project_meta.json"), "w") as f:
        json.dump(meta, f, indent=4)
    print(f"✅ Spawned at: {target_dir}")

def cmd_init(args):
    cwd = os.getcwd()
    if not cwd.startswith(PROJECTS_PATH):
        print("⚠️  Not in CreativeOS Projects folder.")
        if input("Proceed? (y/n): ").lower() != 'y': return

    if os.path.exists(os.path.join(cwd, ".project_meta.json")):
        print("✅ Already initialized.")
        return

    print(f"🪄 Initializing: {os.path.basename(cwd)}...")
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

    notes_dir = os.path.join(cwd, "00_Notes")
    os.makedirs(notes_dir, exist_ok=True)
    if not os.path.exists(os.path.join(notes_dir, "Idea.md")):
        with open(os.path.join(notes_dir, "Idea.md"), "w") as f:
            f.write(f"# {current_name}\nInitialized: {date_str}\n")

    slug = f"{date_str}_{current_name.replace(' ', '_')}"
    meta = {
        "name": current_name, "slug": slug, "type": category,
        "created": date_str, "client": meta_client,
        "template": "adopted_existing", "root": cwd
    }
    with open(os.path.join(cwd, ".project_meta.json"), "w") as f:
        json.dump(meta, f, indent=4)
    print(f"✅ Project adopted! Slug: {slug}")

def cmd_export(args):
    month_path = get_export_month_path()
    meta, project_root = find_meta_in_cwd()
    if meta and not args.simple:
        path = os.path.join(month_path, meta["slug"])
        for s in ["Video", "Thumbnail", "Audio"]: os.makedirs(os.path.join(path, s), exist_ok=True)
        print(f"📂 Project Export: {path}")
        os.startfile(path)
    else:
        print(f"📂 Month Export: {month_path}")
        os.startfile(month_path)

def cmd_sync(args):
    print("🧠 Syncing CreativeOS Brain (Bidirectional)...")
    vault_projects_dir = os.path.join(VAULT_PATH, "01_Active_Projects")
    if not os.path.exists(vault_projects_dir): os.makedirs(vault_projects_dir)

    total_changes = 0
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
            if logs:
                print(f"⚡ {project_name}:")
                for log in logs: print(log)
                total_changes += len(logs)

    if total_changes == 0: print("✅ Everything is up to date.")
    else: print(f"✨ Sync Complete. {total_changes} operations.")

def cmd_thumbs(args):
    print("🖼️  Spinning up Thumbnail Mirror...")
    gallery_root = os.path.join(ROOT_PATH, "04_Global_Assets", "Thumbnails_Mirror")
    if not os.path.exists(gallery_root): os.makedirs(gallery_root)
    
    count = 0
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
                            print(f"  -> Mirrored: {new_name}")
    print(f"✨ Gallery Updated. {count} new thumbnails.")
    os.startfile(gallery_root)

def cmd_clean(args):
    print(f"🧹 Cleaning Downloads: {DOWNLOADS_PATH}")
    if not os.path.exists(DOWNLOADS_PATH): return
    MAPPING = {
        "_Images": [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],
        "_Video": [".mp4", ".mov", ".avi", ".mkv"],
        "_Audio": [".mp3", ".wav", ".aac"],
        "_Docs": [".pdf", ".docx", ".txt", ".xlsx", ".pptx"],
        "_Installers": [".exe", ".msi"],
        "_Archives": [".zip", ".rar", ".7z", ".tar", ".gz"]
    }
    count = 0
    for item in os.listdir(DOWNLOADS_PATH):
        item_path = os.path.join(DOWNLOADS_PATH, item)
        if os.path.isfile(item_path) and not item.startswith("."):
            ext = os.path.splitext(item)[1].lower()
            for folder, extensions in MAPPING.items():
                if ext in extensions:
                    dest_dir = os.path.join(DOWNLOADS_PATH, folder)
                    if not os.path.exists(dest_dir): os.makedirs(dest_dir)
                    try:
                        shutil.move(item_path, os.path.join(dest_dir, item))
                        count += 1
                        print(f"  -> Moved {item} to {folder}")
                    except: pass
                    break
    print(f"✨ Cleanup Complete. {count} files moved.")
    os.startfile(DOWNLOADS_PATH)

def cmd_sort_exports(args):
    inbox_path = os.path.join(EXPORTS_PATH, "_Inbox")
    if not os.path.exists(inbox_path):
        os.makedirs(inbox_path)
        print(f"✨ Created Inbox at: {inbox_path}")
        os.startfile(inbox_path)
        return
    print(f"🗂️  Sorting Inbox: {inbox_path}...")
    if not os.listdir(inbox_path):
        print("✅ Inbox is empty.")
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
            print(f"  -> Filed: {item} into {year}/{month_folder}")
        except Exception as e: print(f"  ❌ Error: {e}")
    print(f"✨ Sorted {count} items.")

def main():
    description_text = """
    🚀 CreativeOS Commander (COS) v1.6
    ----------------------------------
    CREATION:
      cos new "Project Name" [flags]        Create new project
         Flags: -c (code/web/music/ai), --simple, --client "Name", -d "YYYY-MM-DD"
      cos init                              Adopt CURRENT folder as a project
    
    MAINTENANCE:
      cos sync                              Sync Notes -> Obsidian
      cos sort-exports                      File _Inbox items -> Timeline
      cos clean                             Organize Downloads
      cos thumbs                            Update Gallery
    """
    
    parser = argparse.ArgumentParser(description=description_text, formatter_class=RawTextHelpFormatter)
    subparsers = parser.add_subparsers(dest="command")

    p_new = subparsers.add_parser("new", help="Spawn a new project")
    p_new.add_argument("name", type=str)
    p_new.add_argument("-c", "--category", type=str, default="Video")
    p_new.add_argument("-s", "--simple", action="store_true")
    p_new.add_argument("-d", "--date", type=str)
    p_new.add_argument("--client", type=str)

    subparsers.add_parser("init", help="Adopt current folder")

    p_exp = subparsers.add_parser("export", help="Open export folder")
    p_exp.add_argument("-s", "--simple", action="store_true")
    
    subparsers.add_parser("sync", help="Sync Notes")
    subparsers.add_parser("thumbs", help="Update Gallery")
    subparsers.add_parser("clean", help="Clean Downloads")
    subparsers.add_parser("sort-exports", help="Sort Export Inbox")

    args = parser.parse_args()

    if args.command == "new": cmd_new(args)
    elif args.command == "init": cmd_init(args)
    elif args.command == "export": cmd_export(args)
    elif args.command == "sync": cmd_sync(args)
    elif args.command == "thumbs": cmd_thumbs(args)
    elif args.command == "clean": cmd_clean(args)
    elif args.command == "sort-exports": cmd_sort_exports(args)
    else: parser.print_help()

if __name__ == "__main__":
    main()

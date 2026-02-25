import os
import json
import argparse
import datetime
import sys
import shutil
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
    if override_date:
        return override_date
    return datetime.datetime.now().strftime("%Y-%m-%d")

def get_export_month_path():
    now = datetime.datetime.now()
    year = now.strftime("%Y")
    month_name = now.strftime("%B")
    month_num = now.strftime("%m")
    month_folder = f"{month_num} - {month_name}"
    
    full_path = os.path.join(EXPORTS_PATH, year, month_folder)
    if not os.path.exists(full_path):
        os.makedirs(full_path)
    return full_path

def find_meta_in_cwd():
    current = os.getcwd()
    for _ in range(3):
        if ".project_meta.json" in os.listdir(current):
            try:
                with open(os.path.join(current, ".project_meta.json"), "r", encoding="utf-8-sig") as f:
                    return json.load(f), current
            except (json.JSONDecodeError, OSError):
                return None, None
        current = os.path.dirname(current)
        if len(current) < 4:
            break
    return None, None

# --- COMMANDS ---

def cmd_new(args):
    project_name = args.name
    category = args.category.title()
    
    # 1. Date Logic
    date_prefix = get_date_slug(args.date)
    safe_name = project_name.replace(" ", "_")
    slug = f"{date_prefix}_{safe_name}"
    
    # 2. Location Intelligence
    cwd = os.getcwd()
    
    if args.client:
        target_root = os.path.join(PROJECTS_PATH, "Clients", args.client)
        if not os.path.exists(target_root):
            os.makedirs(target_root)
            print(f"✨ Created new Client folder: {args.client}")
    elif cwd.startswith(PROJECTS_PATH):
        target_root = cwd
    else:
        # Map 'Web' to 'Code' folder physically
        phys_cat = "Code" if category.lower() in ["web", "code"] else category
        target_root = os.path.join(PROJECTS_PATH, phys_cat)

    target_dir = os.path.join(target_root, slug)
    
    if os.path.exists(target_dir):
        print(f"⚠️  Project already exists: {target_dir}")
        return

    # 3. Template Logic
    cat_lower = category.lower()
    if cat_lower == "code":
        template_name = "plain_code"
    elif cat_lower == "web":
        template_name = "code_project"
    elif cat_lower in ["music", "audio"]:
        template_name = "audio_project"
    else:
        template_name = "video_project"
    
    template_file = os.path.join(TEMPLATES_PATH, template_name, "structure.json")
    
    if not os.path.exists(template_file):
        print(f"❌ Template not found: {template_name}")
        return
        
    with open(template_file, "r") as f:
        structure = json.load(f)

    # 4. Build
    print(f"🔨 Creating project: {slug}")
    print(f"   Template: {template_name}")
    os.makedirs(target_dir)
    
    for folder, contents in structure.items():
        folder_path = os.path.join(target_dir, folder)
        os.makedirs(folder_path, exist_ok=True)
        for item in contents:
            if "." in item:
                file_path = os.path.join(folder_path, item)
                if not os.path.exists(file_path):
                    with open(file_path, "w") as f:
                        f.write(f"# {item}\nProject: {project_name}\nCreated: {date_prefix}\n")
            else:
                os.makedirs(os.path.join(folder_path, item), exist_ok=True)

    # 5. Notes
    notes_dir = os.path.join(target_dir, "00_Notes")
    os.makedirs(notes_dir, exist_ok=True)
    if not os.path.exists(os.path.join(notes_dir, "Idea.md")):
        with open(os.path.join(notes_dir, "Idea.md"), "w") as f:
            f.write(f"# {project_name}\nDate: {date_prefix}\n")

    # 6. Metadata
    meta_client = "None"
    if args.client:
        meta_client = args.client
    else:
        norm_path = target_root.replace("\\", "/")
        parts = norm_path.split("/")
        if "Clients" in parts:
            try:
                idx = parts.index("Clients")
                if len(parts) > idx + 1:
                    meta_client = parts[idx + 1]
            except:
                pass

    meta = {
        "name": project_name,
        "slug": slug,
        "type": category,
        "created": date_prefix,
        "client": meta_client,
        "template": template_name,
        "root": target_dir
    }
    with open(os.path.join(target_dir, ".project_meta.json"), "w") as f:
        json.dump(meta, f, indent=4)

    print(f"✅ Spawned at: {target_dir}")

def cmd_export(args):
    month_path = get_export_month_path()
    meta, project_root = find_meta_in_cwd()
    
    if meta and not args.simple:
        project_export_folder = os.path.join(month_path, meta["slug"])
        subfolders = ["Video", "Thumbnail", "Audio"]
        for s in subfolders:
            os.makedirs(os.path.join(project_export_folder, s), exist_ok=True)
        print(f"📂 Project Export Folder: {project_export_folder}")
        os.startfile(project_export_folder)
    else:
        print(f"📂 Month Export Folder: {month_path}")
        os.startfile(month_path)

def cmd_sync(args):
    print("🧠 Syncing CreativeOS Brain...")
    vault_projects_dir = os.path.join(VAULT_PATH, "01_Active_Projects")
    if not os.path.exists(vault_projects_dir):
        os.makedirs(vault_projects_dir)

    synced_count = 0
    for root, dirs, files in os.walk(PROJECTS_PATH):
        if ".project_meta.json" in files:
            meta_path = os.path.join(root, ".project_meta.json")
            try:
                with open(meta_path, "r", encoding="utf-8-sig") as f:
                    meta = json.load(f)
            except (json.JSONDecodeError, OSError):
                print(f"⚠️  SKIPPING CORRUPT: {meta_path}")
                continue
            
            project_name = meta.get("slug", "Unknown_Project")
            notes_source = os.path.join(root, "00_Notes")
            notes_dest = os.path.join(vault_projects_dir, project_name)

            if os.path.exists(notes_source):
                if not os.path.exists(notes_dest):
                    os.makedirs(notes_dest)
                for file in os.listdir(notes_source):
                    if file.endswith(".md"):
                        try:
                            shutil.copy2(os.path.join(notes_source, file), os.path.join(notes_dest, file))
                        except Exception: pass
                synced_count += 1
                print(f"  -> Synced: {project_name}")

    print(f"✨ Brain Sync Complete. {synced_count} projects updated.")

def cmd_thumbs(args):
    print("🖼️  Spinning up Thumbnail Mirror...")
    gallery_root = os.path.join(ROOT_PATH, "04_Global_Assets", "Thumbnails_Mirror")
    if not os.path.exists(gallery_root):
        os.makedirs(gallery_root)

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
                        creation_time = os.path.getmtime(src_file)
                        date_str = datetime.datetime.fromtimestamp(creation_time).strftime("%Y-%m-%d")
                        new_filename = f"{date_str}_{project_name}_{img}"
                        dst_file = os.path.join(gallery_root, new_filename)
                        if not os.path.exists(dst_file):
                            shutil.copy2(src_file, dst_file)
                            count += 1
                            print(f"  -> Mirrored: {new_filename}")

    print(f"✨ Gallery Updated. {count} new thumbnails.")
    os.startfile(gallery_root)

def cmd_clean(args):
    """Organizes the Downloads folder."""
    print(f"🧹 Cleaning Downloads at: {DOWNLOADS_PATH}...")
    
    if not os.path.exists(DOWNLOADS_PATH):
        print(f"❌ Error: Downloads path not found: {DOWNLOADS_PATH}")
        return

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
            
            target_folder = None
            for folder, extensions in MAPPING.items():
                if ext in extensions:
                    target_folder = folder
                    break
            
            if target_folder:
                dest_dir = os.path.join(DOWNLOADS_PATH, target_folder)
                if not os.path.exists(dest_dir):
                    os.makedirs(dest_dir)
                
                try:
                    shutil.move(item_path, os.path.join(dest_dir, item))
                    count += 1
                    print(f"  -> Moved {item} to {target_folder}")
                except Exception as e:
                    print(f"  ⚠️ Could not move {item}: {e}")

    print(f"✨ Cleanup Complete. Moved {count} files.")
    os.startfile(DOWNLOADS_PATH)

# --- MAIN ---

def main():
    description_text = """
    🚀 CreativeOS Commander (COS) v1.0
    ----------------------------------
    EXAMPLES:
      cos new "Nike Ad"                     (Default Video Project)
      cos new "Portfolio" -c code           (Simple Code)
      cos new "Saas App" -c web             (Full Stack)
      cos new "Project" --client SternUP    (Client Project)
      
      cos sync                              (Push notes to Obsidian)
      cos clean                             (Sort Downloads Folder)
      cos export                            (Open Monthly Export)
      cos thumbs                            (Update Gallery)
    """
    
    parser = argparse.ArgumentParser(description=description_text, formatter_class=RawTextHelpFormatter)
    subparsers = parser.add_subparsers(dest="command")

    # NEW
    p_new = subparsers.add_parser("new", help="Spawn a new project")
    p_new.add_argument("name", type=str, help="Project Name")
    p_new.add_argument("-c", "--category", type=str, default="Video", help="Template type")
    p_new.add_argument("-d", "--date", type=str, help="Force date")
    p_new.add_argument("--client", type=str, help="Client Name")

    # EXPORT
    p_exp = subparsers.add_parser("export", help="Open export folder")
    p_exp.add_argument("-s", "--simple", action="store_true", help="Force simple view")

    # UTILS
    p_sync = subparsers.add_parser("sync", help="Sync Notes -> Obsidian")
    p_thumbs = subparsers.add_parser("thumbs", help="Update Thumbnail Gallery")
    p_clean = subparsers.add_parser("clean", help="Organize Downloads folder")

    args = parser.parse_args()

    if args.command == "new":
        cmd_new(args)
    elif args.command == "export":
        cmd_export(args)
    elif args.command == "sync":
        cmd_sync(args)
    elif args.command == "thumbs":
        cmd_thumbs(args)
    elif args.command == "clean":
        cmd_clean(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()

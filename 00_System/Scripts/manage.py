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
        # Default Category folder (e.g. 01_Projects/Video)
        # Map 'Web' to 'Code' folder physically, even if logic is different
        phys_cat = "Code" if category.lower() in ["web", "code"] else category
        target_root = os.path.join(PROJECTS_PATH, phys_cat)

    target_dir = os.path.join(target_root, slug)
    
    if os.path.exists(target_dir):
        print(f"⚠️  Project already exists: {target_dir}")
        return

    # 3. Template Logic (The Selector)
    cat_lower = category.lower()
    
    if cat_lower == "code":
        template_name = "plain_code"     # The new simple one
    elif cat_lower == "web":
        template_name = "code_project"   # The complex one (rename folder if needed)
    elif cat_lower in ["music", "audio"]:
        template_name = "audio_project"
    else:
        template_name = "video_project"  # Default
    
    template_file = os.path.join(TEMPLATES_PATH, template_name, "structure.json")
    
    if not os.path.exists(template_file):
        print(f"❌ Template not found: {template_name}\n   Checked: {template_file}")
        return
        
    with open(template_file, "r") as f:
        structure = json.load(f)

    # 4. Build Structure
    print(f"🔨 Creating project: {slug}")
    print(f"   Template: {template_name}")
    os.makedirs(target_dir)
    
    for folder, contents in structure.items():
        # Create the folder path (handles nested like docs/mockup)
        folder_path = os.path.join(target_dir, folder)
        os.makedirs(folder_path, exist_ok=True)
        
        # Create files inside that folder
        for item in contents:
            # If it has an extension, treat as file
            if "." in item:
                file_path = os.path.join(folder_path, item)
                if not os.path.exists(file_path):
                    with open(file_path, "w") as f:
                        f.write(f"# {item}\nProject: {project_name}\nCreated: {date_prefix}\n")
            else:
                # It's a subfolder defined in the list
                os.makedirs(os.path.join(folder_path, item), exist_ok=True)

    # 5. Standard Notes (Always ensure 00_Notes exists)
    notes_dir = os.path.join(target_dir, "00_Notes")
    os.makedirs(notes_dir, exist_ok=True)
    if not os.path.exists(os.path.join(notes_dir, "Idea.md")):
        with open(os.path.join(notes_dir, "Idea.md"), "w") as f:
            f.write(f"# {project_name}\nDate: {date_prefix}\n")

    # 6. Determine Client Name
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

    # 7. Write Metadata
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
            except (json.JSONDecodeError, OSError) as e:
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
                        src_file = os.path.join(notes_source, file)
                        dst_file = os.path.join(notes_dest, file)
                        try:
                            shutil.copy2(src_file, dst_file)
                        except Exception:
                            pass
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
                    except:
                        pass

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

# --- MAIN ---

def main():
    description_text = """
    🚀 CreativeOS Commander (COS)
    -----------------------------
    Your CLI for managing the creative lifecycle.

    EXAMPLES:
      cos new "Nike Ad"                     (Default Video Project)
      cos new "Portfolio" -c code           (Simple Code: docs/src)
      cos new "Saas App" -c web             (Complex: backend/frontend)
      cos new "Beat 1" -c music             (DAW Template)
      cos new "Project" --client SternUP    (Client Project)
      cos sync                              (Push notes to Obsidian)
      cos export                            (Open Monthly Export Folder)
    """
    
    parser = argparse.ArgumentParser(
        description=description_text, 
        formatter_class=RawTextHelpFormatter
    )
    
    subparsers = parser.add_subparsers(dest="command")

    # NEW
    p_new = subparsers.add_parser("new", help="Spawn a new project structure")
    p_new.add_argument("name", type=str, help="Project Name")
    p_new.add_argument("-c", "--category", type=str, default="Video", 
                      help="Template type: Video (default), Code, Web, Music")
    p_new.add_argument("-d", "--date", type=str, help="Force date (YYYY-MM-DD)")
    p_new.add_argument("--client", type=str, help="Specify Client Name")

    # EXPORT
    p_exp = subparsers.add_parser("export", help="Open the organized Export folder")
    p_exp.add_argument("-s", "--simple", action="store_true", help="Force simple view (no subfolders)")

    # SYNC
    p_sync = subparsers.add_parser("sync", help="Sync Project Notes -> Obsidian Vault")

    # THUMBS
    p_thumbs = subparsers.add_parser("thumbs", help="Mirror all thumbnails to Global Gallery")

    args = parser.parse_args()

    if args.command == "new":
        cmd_new(args)
    elif args.command == "export":
        cmd_export(args)
    elif args.command == "sync":
        cmd_sync(args)
    elif args.command == "thumbs":
        cmd_thumbs(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
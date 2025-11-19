import os
import json
import argparse
import datetime
import sys
import shutil
import time

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

def get_date_slug():
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
            with open(os.path.join(current, ".project_meta.json"), "r") as f:
                return json.load(f), current
        current = os.path.dirname(current)
        if len(current) < 4:
            break
    return None, None

# --- COMMANDS ---

def cmd_new(args):
    project_name = args.name
    category = args.category.title()
    
    date_prefix = get_date_slug()
    safe_name = project_name.replace(" ", "_")
    slug = f"{date_prefix}_{safe_name}"
    
    target_dir = os.path.join(PROJECTS_PATH, category, slug)
    
    if os.path.exists(target_dir):
        print(f"⚠️  Project already exists: {target_dir}")
        return

    template_name = "video_project"
    template_file = os.path.join(TEMPLATES_PATH, template_name, "structure.json")
    
    if not os.path.exists(template_file):
        print(f"❌ Template not found: {template_name}")
        return
        
    with open(template_file, "r") as f:
        structure = json.load(f)

    print(f"🔨 Creating project: {slug}...")
    os.makedirs(target_dir)
    
    for folder, subfolders in structure.items():
        path = os.path.join(target_dir, folder)
        os.makedirs(path, exist_ok=True)
        for sub in subfolders:
            if "." in sub: continue
            os.makedirs(os.path.join(path, sub), exist_ok=True)

    notes_dir = os.path.join(target_dir, "00_Notes")
    md_files = ["Idea", "Script", "Metadata", "Tasks", "Research"]
    os.makedirs(notes_dir, exist_ok=True)
    
    for md in md_files:
        file_path = os.path.join(notes_dir, f"{md}.md")
        if not os.path.exists(file_path):
            with open(file_path, "w") as f:
                f.write(f"# {md}\nProject: {project_name}\nDate: {date_prefix}\n\n")

    meta = {
        "name": project_name,
        "slug": slug,
        "type": category,
        "created": date_prefix,
        "template": template_name,
        "root": target_dir
    }
    with open(os.path.join(target_dir, ".project_meta.json"), "w") as f:
        json.dump(meta, f, indent=4)

    print(f"✅ Project Spawned!\n📂 Location: {target_dir}")

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
    """Syncs Project Notes to Obsidian Vault"""
    print("🧠 Syncing CreativeOS Brain...")
    
    # 1. Define where in Obsidian these should go
    vault_projects_dir = os.path.join(VAULT_PATH, "01_Active_Projects")
    if not os.path.exists(vault_projects_dir):
        os.makedirs(vault_projects_dir)

    # 2. Walk through all projects
    synced_count = 0
    
    for root, dirs, files in os.walk(PROJECTS_PATH):
        if ".project_meta.json" in files:
            # We found a CreativeOS Project!
            with open(os.path.join(root, ".project_meta.json"), "r") as f:
                meta = json.load(f)
            
            project_name = meta.get("slug", "Unknown_Project")
            notes_source = os.path.join(root, "00_Notes")
            
            # Destination in Obsidian
            notes_dest = os.path.join(vault_projects_dir, project_name)

            if os.path.exists(notes_source):
                # Ensure destination exists
                if not os.path.exists(notes_dest):
                    os.makedirs(notes_dest)
                
                # Copy MD files
                for file in os.listdir(notes_source):
                    if file.endswith(".md"):
                        src_file = os.path.join(notes_source, file)
                        dst_file = os.path.join(notes_dest, file)
                        
                        # Simple Copy (Overwrite if newer)
                        # In a future update, we can add 'diff' logic here
                        try:
                            shutil.copy2(src_file, dst_file)
                        except Exception as e:
                            print(f"Error copying {file}: {e}")
                
                synced_count += 1
                print(f"  -> Synced: {project_name}")

    print(f"✨ Brain Sync Complete. {synced_count} projects updated in Vault.")

# --- MAIN ---

def main():
    parser = argparse.ArgumentParser(description="CreativeOS Commander")
    subparsers = parser.add_subparsers(dest="command")

    # NEW
    p_new = subparsers.add_parser("new", help="Spawn a new project")
    p_new.add_argument("name", type=str, help="Project Name")
    p_new.add_argument("-c", "--category", type=str, default="Video", help="Category")
    
    # EXPORT
    p_exp = subparsers.add_parser("export", help="Open export folder")
    p_exp.add_argument("-s", "--simple", action="store_true", help="Force simple export")

    # SYNC (GOD TIER)
    p_sync = subparsers.add_parser("sync", help="Sync notes to Obsidian Vault")

    args = parser.parse_args()

    if args.command == "new":
        cmd_new(args)
    elif args.command == "export":
        cmd_export(args)
    elif args.command == "sync":
        cmd_sync(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
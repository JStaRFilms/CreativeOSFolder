import os
import json
import argparse
import datetime
import sys
import shutil

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
    """Returns YYYY-MM-DD. Uses override if provided."""
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
                # FIX: Use utf-8-sig to handle PowerShell BOM
                with open(os.path.join(current, ".project_meta.json"), "r", encoding="utf-8-sig") as f:
                    return json.load(f), current
            except json.JSONDecodeError:
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
        target_root = os.path.join(PROJECTS_PATH, category)

    target_dir = os.path.join(target_root, slug)
    
    if os.path.exists(target_dir):
        print(f"⚠️  Project already exists: {target_dir}")
        return

    # 3. Template Logic
    template_name = "video_project"
    template_file = os.path.join(TEMPLATES_PATH, template_name, "structure.json")
    
    if not os.path.exists(template_file):
        print(f"❌ Template not found: {template_name}")
        return
        
    with open(template_file, "r") as f:
        structure = json.load(f)

    # 4. Build Structure
    print(f"🔨 Creating project: {slug}...")
    os.makedirs(target_dir)
    
    for folder, subfolders in structure.items():
        path = os.path.join(target_dir, folder)
        os.makedirs(path, exist_ok=True)
        for sub in subfolders:
            if "." in sub: continue
            os.makedirs(os.path.join(path, sub), exist_ok=True)

    # 5. Notes
    notes_dir = os.path.join(target_dir, "00_Notes")
    md_files = ["Idea", "Script", "Metadata", "Tasks", "Research"]
    os.makedirs(notes_dir, exist_ok=True)
    
    for md in md_files:
        file_path = os.path.join(notes_dir, f"{md}.md")
        if not os.path.exists(file_path):
            with open(file_path, "w") as f:
                f.write(f"# {md}\nProject: {project_name}\nDate: {date_prefix}\n\n")

    # 6. Determine Metadata Client Name
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
    print("🧠 Syncing CreativeOS Brain...")
    vault_projects_dir = os.path.join(VAULT_PATH, "01_Active_Projects")
    
    if not os.path.exists(vault_projects_dir):
        os.makedirs(vault_projects_dir)

    synced_count = 0
    
    for root, dirs, files in os.walk(PROJECTS_PATH):
        if ".project_meta.json" in files:
            meta_path = os.path.join(root, ".project_meta.json")
            
            try:
                # FIX: Use utf-8-sig to handle BOM from PowerShell
                with open(meta_path, "r", encoding="utf-8-sig") as f:
                    meta = json.load(f)
            except (json.JSONDecodeError, OSError) as e:
                print(f"⚠️  SKIPPING CORRUPT PROJECT: {meta_path} ({e})")
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
                        except Exception as e:
                            print(f"Error copying {file}: {e}")
                
                synced_count += 1
                print(f"  -> Synced: {project_name}")

    print(f"✨ Brain Sync Complete. {synced_count} projects updated in Vault.")

# --- MAIN ---

def main():
    parser = argparse.ArgumentParser(description="CreativeOS Commander")
    subparsers = parser.add_subparsers(dest="command")

    # NEW Command
    p_new = subparsers.add_parser("new", help="Spawn a new project")
    p_new.add_argument("name", type=str, help="Project Name")
    p_new.add_argument("-c", "--category", type=str, default="Video", help="Category")
    p_new.add_argument("-d", "--date", type=str, help="Force date (YYYY-MM-DD)")
    p_new.add_argument("--client", type=str, help="Specify Client Name")

    # EXPORT Command
    p_exp = subparsers.add_parser("export", help="Open export folder")
    p_exp.add_argument("-s", "--simple", action="store_true", help="Force simple export")

    # SYNC Command
    p_sync = subparsers.add_parser("sync", help="Sync notes to Obsidian")

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
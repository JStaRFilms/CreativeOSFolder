import os
import json
import argparse
import datetime
import sys

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

# --- HELPERS ---

def get_date_slug():
    return datetime.datetime.now().strftime("%Y-%m-%d")

def get_export_month_path():
    now = datetime.datetime.now()
    year = now.strftime("%Y")
    month_name = now.strftime("%B")
    month_num = now.strftime("%m")
    # Folder Format: 11 - November
    month_folder = f"{month_num} - {month_name}"
    
    full_path = os.path.join(EXPORTS_PATH, year, month_folder)
    if not os.path.exists(full_path):
        os.makedirs(full_path)
    return full_path

def find_meta_in_cwd():
    """Checks if current directory is inside a CreativeOS project."""
    current = os.getcwd()
    # Traverse up to 3 levels to find .project_meta.json
    for _ in range(3):
        if ".project_meta.json" in os.listdir(current):
            with open(os.path.join(current, ".project_meta.json"), "r") as f:
                return json.load(f), current
        current = os.path.dirname(current)
        if len(current) < 4: # Don't go past drive root
            break
    return None, None

# --- COMMANDS ---

def cmd_new(args):
    """Spawns a new project."""
    project_name = args.name
    category = args.category.title() # Video, Code, AI
    
    # 1. Generate Slug
    date_prefix = get_date_slug()
    safe_name = project_name.replace(" ", "_")
    slug = f"{date_prefix}_{safe_name}"
    
    # 2. Determine Target Path
    target_dir = os.path.join(PROJECTS_PATH, category, slug)
    
    if os.path.exists(target_dir):
        print(f"⚠️  Project already exists: {target_dir}")
        return

    # 3. Load Template Structure
    template_name = "video_project"
    template_file = os.path.join(TEMPLATES_PATH, template_name, "structure.json")
    
    if not os.path.exists(template_file):
        print(f"❌ Template not found: {template_name}")
        return
        
    with open(template_file, "r") as f:
        structure = json.load(f)

    # 4. Create Folders (FIXED LOGIC)
    print(f"🔨 Creating project: {slug}...")
    os.makedirs(target_dir)
    
    for folder, subfolders in structure.items():
        path = os.path.join(target_dir, folder)
        os.makedirs(path, exist_ok=True)
        for sub in subfolders:
            # FIX: If it has a dot (like Idea.md), it's a file, NOT a folder. Skip it.
            if "." in sub:
                continue
            os.makedirs(os.path.join(path, sub), exist_ok=True)

    # 5. Generate Standard Markdown Files (For Obsidian)
    notes_dir = os.path.join(target_dir, "00_Notes")
    md_files = ["Idea", "Script", "Metadata", "Tasks", "Research"]
    
    # Ensure the directory exists (it should, but safety first)
    os.makedirs(notes_dir, exist_ok=True)
    
    for md in md_files:
        file_path = os.path.join(notes_dir, f"{md}.md")
        # Only write if it doesn't exist
        if not os.path.exists(file_path):
            with open(file_path, "w") as f:
                f.write(f"# {md}\nProject: {project_name}\nDate: {date_prefix}\n\n")

    # 6. Write .project_meta.json
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
    """Handles export logic."""
    month_path = get_export_month_path()
    
    # Check if we are inside a project
    meta, project_root = find_meta_in_cwd()
    
    if meta and not args.simple:
        # We are inside a project, and user wants a structured export folder
        project_export_folder = os.path.join(month_path, meta["slug"])
        
        subfolders = ["Video", "Thumbnail", "Audio"]
        for s in subfolders:
            os.makedirs(os.path.join(project_export_folder, s), exist_ok=True)
            
        print(f"📂 Project Export Folder Ready:")
        print(f"   {project_export_folder}")
        os.startfile(project_export_folder)
        
    else:
        # Simple mode OR not in a project
        print(f"📂 Global Export Folder (Month):")
        print(f"   {month_path}")
        os.startfile(month_path)

# --- MAIN ---

def main():
    parser = argparse.ArgumentParser(description="CreativeOS Commander")
    subparsers = parser.add_subparsers(dest="command")

    # NEW Command
    p_new = subparsers.add_parser("new", help="Spawn a new project")
    p_new.add_argument("name", type=str, help="Project Name")
    p_new.add_argument("-c", "--category", type=str, default="Video", help="Category (Video, Code, AI)")
    
    # EXPORT Command
    p_exp = subparsers.add_parser("export", help="Open export folder")
    p_exp.add_argument("-s", "--simple", action="store_true", help="Force simple export (no subfolder)")

    args = parser.parse_args()

    if args.command == "new":
        cmd_new(args)
    elif args.command == "export":
        cmd_export(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
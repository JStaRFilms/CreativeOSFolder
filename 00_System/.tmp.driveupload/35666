import os
import json
import argparse
import datetime
import sys
import shutil
import statistics
import filecmp
from argparse import RawTextHelpFormatter
from tqdm import tqdm
import time
import stat
import subprocess

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
def copy_with_progress(src, dst):
    """Copies files from src to dst, showing a progress bar."""
    # Ensure the destination directory exists
    os.makedirs(dst, exist_ok=True)
    
    # Walk through the source directory to get a list of all files
    all_files = []
    for root, _, files in os.walk(src):
        for name in files:
            all_files.append(os.path.join(root, name))

    # Use tqdm to show progress
    for f in tqdm(all_files, desc="Shuttling Files", unit="file"):
        rel_path = os.path.relpath(f, src)
        dest_file_path = os.path.join(dst, rel_path)
        
        # Create directory for the file if it doesn't exist
        os.makedirs(os.path.dirname(dest_file_path), exist_ok=True)
        
        # Copy the file
        shutil.copy2(f, dest_file_path)

def setup_git(project_path, category):
    """Initializes Git and adds .gitignore."""
    print("   🔧 Initializing Git Repository...")
    
    # 1. Run git init
    try:
        subprocess.run(["git", "init"], cwd=project_path, check=True, stdout=subprocess.DEVNULL)
    except FileNotFoundError:
        print("   ⚠️  Git is not installed or not in PATH. Skipping.")
        return
    except Exception as e:
        print(f"   ❌ Git init failed: {e}")
        return

    # 2. Copy .gitignore
    gitignore_src = os.path.join(TEMPLATES_PATH, "universal.gitignore")
    gitignore_dest = os.path.join(project_path, ".gitignore")
    
    if os.path.exists(gitignore_src):
        shutil.copy2(gitignore_src, gitignore_dest)
    else:
        # Fallback if template missing
        with open(gitignore_dest, "w") as f:
            f.write("# CreativeOS Auto-Gitignore\nnode_modules/\n__pycache__/\n.env\n")

    print("   ✅ Git initialized & .gitignore added.")

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
    # 8. Git Setup (Only if requested)
    if args.git:
        setup_git(target_dir, category)
    
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
    # Determine which folder to clean
    target_path = args.target if args.target else DOWNLOADS_PATH

    print(f"🧹 Cleaning: {target_path}...")
    if not os.path.exists(target_path):
        print(f"❌ Error: Path not found: {target_path}")
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

    count = 0
    for item in os.listdir(target_path):
        if item.startswith("."):
            continue  # Skip dot files/folders

        item_path = os.path.join(target_path, item)

        # Only process files - leave folders untouched
        if os.path.isfile(item_path):
            ext = os.path.splitext(item)[1].lower()
            target_folder = None

            for folder, extensions in MAPPING.items():
                if ext in extensions:
                    target_folder = folder
                    break

            if not target_folder:
                target_folder = "_Other"  # For files with unknown extensions

            if target_folder:
                dest_dir = os.path.join(target_path, target_folder)
                if not os.path.exists(dest_dir): os.makedirs(dest_dir)

                try:
                    shutil.move(item_path, os.path.join(dest_dir, item))
                    count += 1
                    print(f"  -> Moved {item} to {target_folder}")
                except Exception as e:
                    print(f"  ⚠️ Could not move {item}: {e}")

    print(f"✨ Cleanup Complete. {count} files moved.")

    os.startfile(target_path)

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

def cmd_travel(args):
    """Copies the current project to the External Shuttle Drive."""
    meta, project_root = find_meta_in_cwd()
    
    if not meta:
        print("❌ Error: You must be inside an initialized project to use 'travel'.")
        return

    print(f"🚀 Prepping Shuttle Launch for: {meta['name']}...")
    
    if not os.path.exists(SHUTTLE_PATH):
        print(f"❌ Error: Shuttle Drive not found at: {SHUTTLE_PATH}")
        print("   (Check your config.json or plug in the drive)")
        return

    # 1. Determine Destination Structure
    rel_path = os.path.relpath(project_root, PROJECTS_PATH)
    dest_path = os.path.join(SHUTTLE_PATH, "Projects", rel_path)

    print(f"   Source: {project_root}")
    print(f"   Target: {dest_path}")
    
    confirm = input("   Start copy? This might take a while for video. (y/n): ")
    if confirm.lower() != 'y': return

    # 2. Copy Process
    try:
        print("   Calculating files to copy...")
        # The new function handles both creation and update.
        copy_with_progress(project_root, dest_path)
        
    # 3. Stamp the Passport
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(os.path.join(dest_path, "_TRAVEL_LOG.txt"), "a") as f:
            f.write(f"Synced from Desktop at: {timestamp}\n")
            
        print(f"✅ Travel Ready! Project copied to Shuttle.")
        print(f"   Don't forget to Eject safely.")
        os.startfile(dest_path)
        
    except Exception as e:
        print(f"❌ Copy failed: {e}")

def remove_readonly(func, path, excinfo):
    """Error handler for shutil.rmtree that handles read-only files."""
    os.chmod(path, stat.S_IWRITE)
    func(path)

def robust_rmtree(path, retries=5, delay=1):
    """A more robust version of rmtree that handles OneDrive locking."""
    for i in range(retries):
        try:
            shutil.rmtree(path, onerror=remove_readonly)
            return True
        except OSError as e:
            print(f"Attempt {i+1}/{retries}: Failed to remove {path}. Retrying in {delay}s... Error: {e}")
            time.sleep(delay)
    print(f"❌ Failed to remove directory after {retries} retries: {path}")
    return False

def cmd_resurrect(args):
    """Brings a project back from the dead (Archive -> Active)."""
    search_term = args.name.lower()
    print(f"Searching Archive for: '{args.name}'...")
    
    if not os.path.exists(ARCHIVE_PATH):
        print(f"Error: Archive path not found: {ARCHIVE_PATH}")
        return

    # 1. Search for matching folders
    matches = []
    for root, dirs, files in os.walk(ARCHIVE_PATH):
        # Only look at top-level folders in archive or client subfolders to avoid deep scanning
        # Simplified: Just look at immediate children of Archive + children of "Clients" in Archive
        for d in dirs:
            if search_term in d.lower():
                matches.append(os.path.join(root, d))
        # Don't go too deep
        if root.count(os.sep) - ARCHIVE_PATH.count(os.sep) > 1:
            del dirs[:]

    if not matches:
        print("No matching projects found in Archive.")
        return

    # 2. Select Project
    selected_path = matches[0]
    if len(matches) > 1:
        print("Multiple matches found:")
        for i, m in enumerate(matches):
            print(f"   {i+1}. {m}")
        try:
            choice = int(input("Select project number: ")) - 1
            selected_path = matches[choice]
        except:
            print("Invalid selection.")
            return

    project_name = os.path.basename(selected_path)
    print(f"Resurrecting: {project_name}")

    # 3. Determine Destination (Read old metadata if possible)
    category = "Video" # Default fallback
    meta_path = os.path.join(selected_path, ".project_meta.json")
    
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8-sig") as f:
                meta = json.load(f)
                category = meta.get("type", "Video")
                # Handle Client context
                if meta.get("client") and meta.get("client") != "None":
                    dest_root = os.path.join(PROJECTS_PATH, "Clients", meta["client"])
                else:
                    # Map category to folder
                    if category.lower() in ["web", "code"]: dest_cat = "Code"
                    elif category.lower() in ["music", "audio"]: dest_cat = "Music"
                    elif category.lower() == "ai": dest_cat = "AI"
                    else: dest_cat = "Video"
                    dest_root = os.path.join(PROJECTS_PATH, dest_cat)
        except:
            dest_root = os.path.join(PROJECTS_PATH, "Video") # Fallback
    else:
        # No metadata? Ask user or default to Video
        dest_root = os.path.join(PROJECTS_PATH, "Video")

    # Ensure destination parent exists
    if not os.path.exists(dest_root):
        os.makedirs(dest_root)

    final_dest = os.path.join(dest_root, project_name)

    if os.path.exists(final_dest):
        print(f"Warning: Project already exists in Active Projects: {final_dest}")
        return

    # 4. Move
    try:
        print("Copying project from archive...")
        shutil.copytree(selected_path, final_dest)
        
        print("Removing project from archive...")
        if robust_rmtree(selected_path):
            print(f"✨ LIVE! Project moved to:\n   {final_dest}")
            os.startfile(final_dest)
        else:
            print(f"❌ Could not remove the project from the archive. It has been copied, but the original may still exist.")
    except Exception as e:
        print(f"❌ An unexpected error occurred: {e}")

# --- MAIN ---

def main():
    banner = r"""
   ______                _   _            ___  ____
  / ____/________  ____ | | | |__   ___  / _ \/ ___|
 | |   | '__/ _ \/ _` || |_| |\ \ / / _ \| | | \___ \
 | |___| | |  __/ (_| ||  _  | \ V /  __/ |_| |___) |
  \____|_|  \___|\__,_||_| |_|  \_/ \___|\___/|____/
    """
    
    help_text = f"""{banner}
    The Central Nervous System for your Creative Workflow.
    ====================================================

    1. CREATION COMMANDS
    --------------------
    cos new "Name" [flags]
        Creates a new project. Context-aware: detects where you are.
        
        Flags:
          -c, --category  : Template (Video, Code, Web, Music, AI). Default: Video.
          -s, --simple    : "Wrapper Mode". Creates ONLY Metadata + Notes. No subfolders.
          -d, --date      : "Time Travel". Force specific date (YYYY-MM-DD).
          --client        : Force project into specific Client folder.

        Examples:
          cos new "Nike Ad"                     -> 01_Projects/Video/Date_Nike_Ad
          cos new "React App" -c web            -> 01_Projects/Code/Date_React_App
          cos new "Beat 1" -c music --simple    -> 01_Projects/Music/Date_Beat_1 (Empty shell)
          cos new "Campaign" --client SternUP   -> 01_Projects/Clients/SternUP/Date_Campaign

    cos init
        "Blesses" an existing folder. Run this INSIDE a folder you just dragged in.
        - Calculates "Smart Date" (median file date).
        - Generates .project_meta.json.
        - Creates Note file.
        - Does NOT rename the folder (Safety first).

    2. WORKFLOW COMMANDS
    --------------------
    cos export [flags]
        Opens the correct export destination.
        - Inside a Project: Opens `02_Exports/Year/Month/ProjectName`.
        - Outside a Project: Opens `02_Exports/Year/Month` (Generic bucket).
        
        Flags:
          -s, --simple    : Force open the Generic Month bucket, even if inside a project.

    cos sync
        Bidirectional Brain Bridge. Syncs `00_Notes` <-> Obsidian Vault.
        - Strategy: Last Write Wins.
        - Safety: Creates .bak files on conflict.
        - Injects Dataview YAML metadata automatically.

    3. MAINTENANCE COMMANDS
    -----------------------
    cos clean [flags]
        The Janitor. Sorts loose files into _Images, _Video, _Installers, etc.
        
        Flags:
          -t, --target    : Specify folder to clean. (Default: E:\\Downloads)
        
        Examples:
          cos clean                     (Cleans Downloads)
          cos clean -t "C:\\Desktop"    (Cleans Desktop)

    cos sort-exports
        The Portal. Moves files from `02_Exports/_Inbox` into the Timeline.
        - Reads file creation date.
        - Moves to `02_Exports/YYYY/MM - Month`.

    cos thumbs
        The Gallery. Scans all projects for `02_Assets/Thumbnails`.
        - Copies them to `04_Global_Assets/Thumbnails_Mirror`.
        - Renames with Date + Project Name.
    """
    
    parser = argparse.ArgumentParser(
        description=help_text, 
        formatter_class=RawTextHelpFormatter,
        usage="cos <command> [options]"
    )
    
    subparsers = parser.add_subparsers(dest="command", title="Commands")
    
    # --- NEW ---
    p_new = subparsers.add_parser("new", help="🚀 Spawn a new project")
    p_new.add_argument("name", type=str, help="Project Name")
    p_new.add_argument("-c", "--category", type=str, default="Video", help="Category: Video, Code, Web, Music, AI")
    p_new.add_argument("-s", "--simple", action="store_true", help="Use minimal template (Notes + Meta only)")
    p_new.add_argument("-d", "--date", type=str, help="Override date (YYYY-MM-DD)")
    p_new.add_argument("--client", type=str, help="Group under specific Client")
    p_new.add_argument("-g", "--git", action="store_true", help="Initialize Git repository")

    # --- INIT ---
    subparsers.add_parser("init", help="🪄  Adopt current folder into OS")

    # --- EXPORT ---
    p_exp = subparsers.add_parser("export", help="📂 Open export location")
    p_exp.add_argument("-s", "--simple", action="store_true", help="Force month bucket")

    # --- SYNC ---
    subparsers.add_parser("sync", help="🧠 Sync Notes <-> Obsidian")

    # --- THUMBS ---
    subparsers.add_parser("thumbs", help="🖼️  Update Thumbnail Gallery")

    # --- CLEAN ---
    p_clean = subparsers.add_parser("clean", help="🧹 Sort Downloads or Target")
    p_clean.add_argument("-t", "--target", type=str, help="Specific folder to clean")

    # --- SORT EXPORTS ---
    subparsers.add_parser("sort-exports", help="🗂️  File _Inbox -> Timeline")

    # --- TRAVEL ---
    subparsers.add_parser("travel", help="🚀 Copy Project to External Shuttle")
    
    # --- RESURRECT ---
    subparsers.add_parser("resurrect", help="🕯️ Restore project from Archive").add_argument("name", type=str)
    
    args = parser.parse_args()

    if args.command == "new": cmd_new(args)
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
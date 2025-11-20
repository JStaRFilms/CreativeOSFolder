import os
import json
import datetime

# --- CONFIGURATION ---
# CHANGE THIS to where you actually want the root to be.
# Since you are on the 2TB SSD, let's assume it is C: or D:
ROOT_DIR = os.getcwd()  # Uses the current folder you run the script in

# The Structure We Agreed On
STRUCTURE = {
    "00_System": ["Scripts", "Config", "Templates"],
    "01_Projects": ["Video", "Code", "AI", "Music", "Clients"],
    "02_Exports": [], # Will be populated by year/month logic later
    "03_Vault": ["00_Dashboard", "01_Project_Links", "02_Journal"],
    "04_Global_Assets": ["Thumbnails_Mirror"]
}

# The Master Config File
CONFIG_DATA = {
    "root_path": ROOT_DIR,
    "projects_path": os.path.join(ROOT_DIR, "01_Projects"),
    "exports_path": os.path.join(ROOT_DIR, "02_Exports"),
    "templates_path": os.path.join(ROOT_DIR, "00_System", "Templates"),
    "vault_path": os.path.join(ROOT_DIR, "03_Vault"),
    "version": "1.0"
}

# The Video Template We Agreed On
TEMPLATE_VIDEO = {
    "00_Notes": ["Idea.md", "Script.md", "Metadata.md", "Tasks.md"],
    "01_Footage": ["A-Roll", "B-Roll", "Screen", "Audio", "Misc"],
    "02_Assets": ["Graphics", "Thumbnails", "Music", "SFX"],
    "03_Resolve": ["Timelines", "Cache", "Subtitles"],
    "04_Previews": [],
    "99_Archive": []
}

def create_structure(base, structure):
    for folder, subfolders in structure.items():
        path = os.path.join(base, folder)
        os.makedirs(path, exist_ok=True)
        print(f"✅ Created: {folder}")
        for sub in subfolders:
            os.makedirs(os.path.join(path, sub), exist_ok=True)

def create_template(name, structure):
    template_path = os.path.join(ROOT_DIR, "00_System", "Templates", name)
    os.makedirs(template_path, exist_ok=True)
    
    # Create structure.json for the template
    with open(os.path.join(template_path, "structure.json"), "w") as f:
        json.dump(structure, f, indent=4)
    
    print(f"⚡ Created Template: {name}")

def install():
    print(f"🚀 Initializing CreativeOS at: {ROOT_DIR}")
    
    # 1. Create Main Folders
    create_structure(ROOT_DIR, STRUCTURE)
    
    # 2. Write Config File
    config_path = os.path.join(ROOT_DIR, "00_System", "Config", "config.json")
    with open(config_path, "w") as f:
        json.dump(CONFIG_DATA, f, indent=4)
    print(f"🧠 System Config written to: {config_path}")

    # 3. Install Video Template
    create_template("video_project", TEMPLATE_VIDEO)
    
    # 4. Create Export Year Folder (Current Year)
    current_year = datetime.datetime.now().strftime("%Y")
    os.makedirs(os.path.join(ROOT_DIR, "02_Exports", current_year), exist_ok=True)
    
    print("\n✨ SYSTEM INSTALLED SUCCESSFULLY.")
    print("You can now move your files into these folders.")

if __name__ == "__main__":
    install()
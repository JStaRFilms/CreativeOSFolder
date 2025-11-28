# 🚀 CreativeOS - The Master Manual
### The Central Nervous System for Creative Workflows

> Version: 2.0 (The "Overkill" Update)
> 
> Status: Production
> 
> Language: Python 3.10+
**System Architect:** J Star

```text
   ______                _   _            ___  ____ 
  / ____/________  ____ | | | |__   ___  / _ \/ ___|
 | |   | '__/ _ \/ _` || |_| |\ \ / / _ \| | | \___ \
 | |___| | |  __/ (_| ||  _  | \ V /  __/ |_| |___) |
  \____|_|  \___|\__,_||_| |_|  \_/ \___|\___/|____/ 
```

---

# CreativeOS (COS) CLI

### The Central Nervous System for Creative Workflows

> Version: 2.0 (The "Overkill" Update)
> 
> Status: Production
> 
> Language: Python 3.10+

## 📖 Table of Contents

1. [Philosophy & Architecture](#philosophy--architecture)
    
2. [Installation & Configuration](#installation--configuration)
    
3. [Context Awareness (How it Thinks)](#context-awareness-how-it-thinks)
    
4. [Genesis: Creating Projects](#genesis-creating-projects)
    
    - [The `new` Command](#the-new-command)
        
    - [The `clone` Command](#the-clone-command)
        
    - [The `init` Command](#the-init-command)
        
5. [The Synapse: Syncing Logic](#the-synapse-syncing-logic)
    
6. [Logistics & Asset Management](#logistics--asset-management)
    
    - [Cleaning Downloads](#cleaning-downloads)
        
    - [Sorting Exports](#sorting-exports)
        
    - [Thumbnail Mirroring](#thumbnail-mirroring)
        
7. [Lifecycle: Travel & Resurrection](#lifecycle-travel--resurrection)
    
    - [Travel (Shuttle Mode)](#travel-shuttle-mode)
        
    - [Resurrection (Archive Retrieval)](#resurrection-archive-retrieval)

## 🧠 Philosophy & Architecture

**CreativeOS (cos)** is not just a file automation script; it is a context-aware wrapper for your entire file system. It bridges the gap between your folder structure (Windows Explorer), your knowledge base (Obsidian), and your archives.

It relies on a **Hub-and-Spoke** model defined in your `config.json`:

- **Projects Path:** The active workspace where you create.
    
- **Vault Path:** The brain (Obsidian) where you think.
    
- **Archive Path:** The graveyard/storage for completed works.
    
- **Shuttle Path:** The transport layer (External SSDs).
    

### The "Soul" of a Project

Every project created or adopted by COS contains a hidden file: `.project_meta.json`. This file is the DNA of the project. It stores:

- The Project Name & Slug
    
- Creation Date (even if backdated)
    
- Client Association
    
- Category (Video, Code, Music, AI)
    
- Original Template Used
    

Without this file, a folder is just a folder. With it, it is a **CreativeOS Node**.

## 🔧 Installation & Configuration

CreativeOS is managed through a Python script, typically executed via a batch file alias for global access.

### Prerequisites

1. **Python 3.10+**: Ensure Python is added to your system PATH.
    
2. **Dependencies**: The system uses `tqdm` for visual progress bars.
    
    ```
    pip install tqdm
    ```
    

### Configuration (`config.json`)

The system cannot function without a central map. Located at `00_System/Config/config.json`, this file defines the physical locations of your workflow.

**Critical Paths:**

- `root_path`: The anchor for the entire OS.
    
- `projects_path`: Where new projects spawn.
    
- `templates_path`: Contains `structure.json` files for `simple`, `code`, `video`, etc.
    
- `vault_path`: The Obsidian vault root.
    
- `shuttle_path`: Drive letter for external backups (e.g., `D:\\Shuttle`).
    

## 👁️ Context Awareness (How it Thinks)

One of the most powerful features of `cos` is that you rarely need to tell it _where_ you are.

### The "3-Level Up" Rule

When you run a context-dependent command (like `export`, `travel`, or `sync`), COS doesn't just check your current folder. It performs a **recursive upward search**.

Scenario:

You are working deep inside a project:

P:\Active\Video\2023_Nike_Ad\04_Exports\Social_Media\Revisions\

If you run `cos export` here, COS:

1. Checks current folder for `.project_meta.json`. (Fail)
    
2. Checks `../` (Fail)
    
3. Checks `../../` (Fail)
    
4. Checks `../../../` -> **Found it!** (`P:\Active\Video\2023_Nike_Ad\.project_meta.json`)
    

**Result:** It opens the Export folder specifically for the "Nike Ad" project, not the generic monthly export folder.

### Implicit Category Inference

When running `cos init` or `cos clone` without flags, COS looks at the path string to guess the category.

- If path contains `/Clients/`, it extracts the Client name.
    
- If path contains `/Code/` or `/Web/`, it sets type to `Code`.
    
- If path contains `/AI/`, it sets type to `AI`.
    

## 🚀 Genesis: Creating Projects

### The `new` Command

Spawns a fresh project based on templates (`simple`, `code`, `video`, `audio`, `ai`). It validates name uniqueness and sets up directory structures.

```
cos new "Project Name" [flags]
```

**Arguments & Flags:**

- `name` (Required): The base name (e.g., "Nike Commercial").
    
- `-c` / `--category` (Default: "Video"): "Code", "Web", "AI", "Audio".
    
- `--client`: Groups the project under a client subfolder (e.g., `.../Clients/Apple/`).
    
- `-d` / `--date`: Backdate the project (Format: YYYY-MM-DD).
    
- `-g` / `--git`: Initializes a Git repository and adds a universal `.gitignore`.
    
- `-s` / `--simple`: Uses a minimal folder structure instead of the full template.
    

**The Logic Flow:**

1. **Sanitization:** Converts "My Cool Project" to `2025-10-24_My_Cool_Project`.
    
2. **Routing:** Checks for client flags or category defaults to determine the destination path.
    
3. **Templating:** Hydrates the folder based on `structure.json`.
    
4. **Metadata:** Generates the JSON DNA and an `Idea.md` note.
    

**Example:**

```
cos new "Neural Net Test" -c AI --client "Personal R&D" -g -d "2023-01-01"
```

### The `clone` Command

Clones a remote Git repository and immediately "Blesses" it into the CreativeOS ecosystem.

```
cos clone <url> [flags]
```

**Arguments & Flags:**

- `url` (Required): The https or ssh git URL.
    
- `-n` / `--name`: Override the folder name (defaults to repo name).
    
- `-c` / `--category` (Default: "Code"): Sets the category metadata.
    
- `--client`: Clones directly into a client folder.
    

Smart Defaults:

Unlike new (which defaults to Video), clone defaults to Code. It automatically creates a .project_meta.json linking back to the Source URL in the metadata.

### The `init` Command

"Adopts" an existing folder that wasn't created via COS.

```
cos init
```

**Intelligence:**

- **Smart Date:** Calculates the median timestamp of all files inside to infer the "real" start date of the project.
    
- **Path Inference:** Scans the directory tree to auto-assign Client and Category based on where the folder lives.
    

## ⚡ The Synapse: Syncing Logic

The `cos sync` command is the bridge between your file system and your Obsidian Vault.

```
cos sync
```

### The Conflict Resolution Algorithm

This is not a simple copy-paste. It performs a **Bidirectional Sync** on the `00_Notes` folder of every active project.

**For every file (`Idea.md`, `Script.md`), it runs this logic:**

1. **New in Project?** -> Push to Vault.
    
2. **New in Vault?** -> Pull to Project.
    
3. **Conflict (File exists in both)?**
    
    - It compares contents byte-for-byte.
        
    - **Timestamps:**
        
        - If Project is newer -> Overwrite Vault.
            
        - If Vault is newer -> **Safety Mode:**
            
            1. Create `Idea.md.bak` in the Project (preserve local work).
                
            2. Overwrite Project file with Vault version.
                
    - **Anomaly Check:** If timestamps are identical but content differs, it forces a push to Vault to ensure consistency.
        

## 📦 Logistics & Asset Management

### Cleaning Downloads

Sorts a chaotic folder into `_Images`, `_Video`, `_Installers`, `_Archives`, etc.

```
cos clean [optional path]
```

- **Target:** If no path is provided, it defaults to the User's Download folder.
    
- **Safety:** It **never** moves folders, only files. It leaves dotfiles (`.DS_Store`, `.ini`) alone.
    
- **Fallback:** Unknown extensions go to `_Other`.
    

### Sorting Exports

Targets your global `_Inbox` (where you might dump quick renders).

```
cos sort-exports
```

- **Smart Filing:** Reads the file creation date.
    
- **Action:** Moves file to `Exports/YYYY/MM - Month/`.
    
- **Versioning:** If `render.mp4` exists in the destination, it automatically renames the incoming file to `render_v2.mp4`, `render_v3.mp4`, etc.
    

### Thumbnail Mirroring

Walks the entire Project structure looking for `02_Assets/Thumbnails`.

```
cos thumbs
```

- **Aggregation:** Copies valid images to a central `Global_Assets/Thumbnails_Mirror` folder.
    
- **Renaming:** Prefixes the filename with the Project Date and Name (`2024-10-05_ProjectName_thumb.jpg`) so your global gallery is chronologically sorted.
    

## ♻️ Lifecycle: Travel & Resurrection

### Travel (Shuttle Mode)

Designed for moving a project from Desktop to a portable SSD (`SHUTTLE_PATH`).

```
cos travel
```

- **Prerequisite:** Must be run inside a project (uses Context Awareness).
    
- **Mirroring:** Recreates the folder structure on the external drive.
    
- **Passport:** Writes a `_TRAVEL_LOG.txt` in the destination folder, logging exactly when the sync happened.
    
- **Progress:** Uses `tqdm` for a visual progress bar (essential for large video projects).
    

### Resurrection (Archive Retrieval)

Brings a project back from the dead (`ARCHIVE_PATH`).

```
cos resurrect "Project Name"
```

- **Search:** Scans the Archive for matches.
    
- **Recall:** Reads the archived `.project_meta.json` to remember where the project originally belonged (e.g., Code vs Video, Client vs Personal).
    
- **Restoration:** Moves the folder back to Active Projects and removes it from Archive.
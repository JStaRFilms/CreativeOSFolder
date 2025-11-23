# 📘 CreativeOS: The Complete User Manual

> **Welcome to your new Operating System.**
> CreativeOS (COS) is not just a script; it is a philosophy. It is designed to remove the friction between "having an idea" and "starting the work."

---

## 🧭 The Core Philosophy
1.  **Standardization**: Every project looks the same, so you never lose files.
2.  **Separation of Concerns**:
    *   **Projects (Active Work)**: Where the mess happens.
    *   **Exports (Finished Work)**: Where the results live.
    *   **Vault (Knowledge)**: Where the ideas live.
3.  **Automation**: Computers should do the boring stuff (creating folders, moving files, renaming things).

---

## 🎮 The Command Line Interface (CLI)

The `cos` command is your magic wand. Open your terminal (PowerShell recommended) and type `cos` to see the banner.

### 1. 🚀 Spawning Projects (`cos new`)
Stop manually creating "New Folder", "New Folder (2)", "Audio", "Video".

**Basic Usage:**
```powershell
cos new "My Awesome Project"
# Creates: C:\CreativeOS\01_Projects\Video\2025-11-23_My_Awesome_Project
```

**The "Category" Switch (`-c`):**
Different projects need different structures.
*   `cos new "Beat Tape Vol 1" -c music` (Adds Stems, Project Files, Master folders)
*   `cos new "Portfolio Site" -c code` (Adds src, dist, assets folders)
*   `cos new "AI Model Test" -c ai` (Adds Dataset, Models, Outputs folders)

**The "Client" Switch (`--client`):**
Group work by client automatically.
```powershell
cos new "Q4 Ad Campaign" --client Nike
# Creates: C:\CreativeOS\01_Projects\Clients\Nike\2025-11-23_Q4_Ad_Campaign
```

**The "Quick Idea" Switch (`-s`):**
For when you just need a folder and don't want the full heavy template.
```powershell
cos new "Quick Scratchpad" -s
# Creates a minimal folder with just a Notes file.
```

---

### 2. 🪄 Adopting Existing Projects (`cos init`)
Have a folder full of files that you created *before* CreativeOS? Don't move it manually.

1.  Open your terminal inside that folder.
2.  Run `cos init`.

**What happens?**
*   It scans the files to find the **median creation date** (Smart Date).
*   It detects if you are in a "Client" folder or a "Category" folder.
*   It creates the `.project_meta.json` file.
*   **Result:** The project is now fully compatible with `sync`, `export`, and `thumbs`.

---

### 3. 🧠 The "Second Brain" Sync (`cos sync`)
This is the most powerful feature. It links your Project folders to your Obsidian Vault.

*   **The Problem:** You take notes in your project folder (`Idea.md`), but your knowledge base is in Obsidian. You forget to copy them.
*   **The Solution:** Bidirectional Sync.

**How it works:**
1.  Run `cos sync`.
2.  It looks at `Project/00_Notes` and `Obsidian/Projects/<ProjectName>`.
3.  **Logic:**
    *   New file? -> Copied to the other side.
    *   Changed file? -> The **newest** version wins.
    *   Conflict? -> The loser is backed up as `.bak` so you never lose data.

**Pro Tip:** You can manage your entire project's to-do list from Obsidian on your phone, run `cos sync` when you get to your desktop, and the files will appear in your project folder.

---

### 4. 🧹 The Housekeeper (`cos clean`)
Your Downloads folder is a graveyard of memes, installers, and PDFs.

**Usage:**
```powershell
cos clean
```
**Result:**
It scans `E:\Downloads` and moves files into:
*   `_Images`
*   `_Video`
*   `_Installers`
*   `_Docs`
*   `_Archives`

---

### 5. 📤 The Export Pipeline (`cos export` & `cos sort-exports`)
Never ask "Where did I render that video?" again.

**Step A: The Render**
When you are inside a project, run `cos export`. It opens the correct folder:
`C:\CreativeOS\02_Exports\2025\11 - November\My_Project_Slug\Video`

**Step B: The Inbox Workflow**
Sometimes you just have a loose file (a quick Photoshop export, a meme).
1.  Save it to `C:\CreativeOS\02_Exports\_Inbox`.
2.  Run `cos sort-exports`.
3.  It reads the file's creation date and moves it to `2025\11 - November`.

---

## ⚡ Power User Workflows (Combos)

### The "Client Onboarding" Combo
You get a new client, "Acme Corp", with 50GB of existing assets.
1.  Create the structure: `cos new "Onboarding" --client Acme_Corp`
2.  Navigate to `C:\CreativeOS\01_Projects\Clients\Acme_Corp`.
3.  Dump their hard drive contents into a folder called `Legacy_Assets`.
4.  Go into `Legacy_Assets` and run `cos init`.
5.  Now their old assets are indexed and part of the system!

### The "Visual Database" Combo
You want to see what you've worked on this month without opening 50 folders.
1.  Ensure all your projects have a thumbnail in `02_Assets\Thumbnails`.
2.  Run `cos thumbs`.
3.  Open `C:\CreativeOS\04_Global_Assets\Thumbnails_Mirror`.
4.  Set view to "Extra Large Icons".
5.  **Result:** A visual timeline of every project you've ever made, sorted by date.

### The "Code & Design" Hybrid
You are building a website (Code) but need to edit assets (Design).
1.  `cos new "My Website" -c web`
2.  This creates a `src` folder for code and an `assets` folder for raw design files.
3.  Use VS Code for the root.
4.  Use Photoshop for the `assets` folder.
5.  Run `cos sync` to keep your `README.md` and `dev_notes.md` synced to Obsidian so you can reference code snippets on the go.

---

## 🛠️ Customization
Want to change the folder structures?
Edit the JSON files in: `C:\CreativeOS\00_System\Templates\`

*   `video_project/structure.json`
*   `code_project/structure.json`
*   etc.

**Format:**
```json
{
    "01_Footage": ["Camera_A", "Camera_B"],
    "02_Assets": ["Music", "GFX"]
}
```

---

## ⚠️ Troubleshooting
*   **"Config not found"**: Ensure `C:\CreativeOS\00_System\Config\config.json` exists.
*   **"Sync Conflict"**: If you see a `.bak` file, it means both sides changed. Compare them and delete the `.bak` when done.
*   **"Access Denied"**: Close any files (like the `config.json`) before running commands that might edit them.

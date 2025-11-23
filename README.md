# 🚀 CreativeOS - The Master Manual
**Version:** 1.6 (Gold Master)
**System Architect:** J Star

```text
   ______                _   _            ___  ____ 
  / ____/________  ____ | | | |__   ___  / _ \/ ___|
 | |   | '__/ _ \/ _` || |_| |\ \ / / _ \| | | \___ \
 | |___| | |  __/ (_| ||  _  | \ V /  __/ |_| |___) |
  \____|_|  \___|\__,_||_| |_|  \_/ \___|\___/|____/ 
```

---

## 🌌 1. System Architecture & Philosophy

CreativeOS is not just a script; it is a hardware and software philosophy designed to separate **Creation** from **Consumption** and **Archival**.

### 💾 The Drive Map
| Drive | Role | Description | Backup Strategy |
| :--- | :--- | :--- | :--- |
| **C: (2TB NVMe)** | **CreativeOS** | The Active Workspace. Only contains the OS, Apps, and *Active* Projects. | **Google Drive** (Selective Sync) + **GitHub** |
| **E: (1TB SSD)** | **The Engine** | High-speed storage for Assets, Cache, Downloads, and AI Models. | **Manual / None** (Replaceable data) |
| **D: (1TB HDD)** | **The Vault** | Cold storage for Archives, Documents, and Installers. | **OneDrive** (1TB Business) |

### 🧠 The Logic Core
The system is controlled by `manage.py` (alias: `cos`). It enforces structure using **Metadata Injection**. Every valid project contains a `.project_meta.json` file, which acts as its ID card.

---

## 🎮 2. Command Reference: `cos new`
**Purpose:** Spawns a new project skeleton.
**Syntax:** `cos new "Name" [flags]`

### 🧩 The Logic Matrix (Where does it go?)
The script is **Context Aware**. The destination depends on **where** you run the command.

| Your Location in Terminal | Command Ran | Resulting Path | Context Detected |
| :--- | :--- | :--- | :--- |
| `C:\Anywhere` | `cos new "Test"` | `01_Projects\Video\Date_Test` | Default Category (Video) |
| `C:\Anywhere` | `cos new "App" -c code` | `01_Projects\Code\Date_App` | Category Override |
| `C:\Anywhere` | `cos new "Ad" --client Nike` | `01_Projects\Clients\Nike\Date_Ad` | Client Flag (High Priority) |
| `...\Clients\Nike` | `cos new "Campaign"` | `...\Clients\Nike\Date_Campaign` | **Auto-Detected Client** |
| `...\Code` | `cos new "Bot"` | `...\Code\Date_Bot` | **Auto-Detected Category** |

### 🛠 Template Modes (How does it look?)
The `-c` (Category) and `-s` (Simple) flags determine the folder structure.

| Flag Combo | Template Used | Folders Created | Best For |
| :--- | :--- | :--- | :--- |
| `-c Video` (Default) | `video_project` | Footage, Assets, Resolve, Notes | Standard Editing |
| `-c Code` | `plain_code` | src, docs | Coding Projects |
| `-c Web` | `code_project` | notes, src, docs, tests, assets | Full Stack Apps |
| `-c Music` | `audio_project` | Project_Files, Stems, Exports | DAW Sessions |
| `-c AI` | `ai_project` | Data, Models, Notebooks, Src | Machine Learning |
| `-s` / `--simple` | `simple` | **Only** `00_Notes` & `json` | Wrappers, Quick Tasks |

### 🕰 Time Travel (`-d`)
**Scenario:** You started a project last week but forgot to make a folder.
**Command:** `cos new "Late Project" -d "2025-11-10"`
**Result:** Folder created as `2025-11-10_Late_Project`. Metadata records the past date.

---

## 🪄 3. Command Reference: `cos init`
**Purpose:** "Blesses" an existing folder so it becomes part of CreativeOS without deleting its contents.
**Syntax:** `cos init` (Run inside the folder)

### 🧠 How it works
1.  **Date Analysis:** It scans all files in the folder, finds the **Median Date**, and sets that as the Project Creation Date.
2.  **Context Detection:** It looks at the path.
    *   If inside `Clients\SternUP`, it sets metadata `Client: SternUP`.
    *   If inside `Video\J_Star_Films`, it sets metadata `Client: J_Star_Films`.
3.  **Slug Generation:** It creates a virtual slug `YYYY-MM-DD_Name` in the JSON, but **DOES NOT** rename the physical folder (to prevent file-in-use errors).

**Use Case:** You drag an old hard drive folder `Wedding_Edit_2022` into `01_Projects\Video`. You enter it and run `cos init`. It is now trackable and exportable.

---

## 📤 4. Command Reference: `cos export`
**Purpose:** Opens the correct export location.
**Syntax:** `cos export [flags]`

### 📍 Context Behavior
*   **Scenario A (Inside a Project):**
    *   You are in `...\Clients\Nike\Ad_Campaign`.
    *   You run `cos export`.
    *   System reads `.project_meta.json` -> Finds Slug.
    *   **Result:** Opens `02_Exports\2025\11 - November\2025-11-23_Ad_Campaign`.
    *   *Note: It auto-creates subfolders: Video, Audio, Thumbnail.*

*   **Scenario B (System Root / No Project):**
    *   You are in `C:\`.
    *   You run `cos export`.
    *   **Result:** Opens `02_Exports\2025\11 - November` (The generic month bucket).

*   **Scenario C (Forcing Simple Mode):**
    *   You are inside a project, but you just want to dump a quick render, not make subfolders.
    *   Run `cos export -s`.
    *   **Result:** Opens the generic month bucket, ignoring the project context.

---

## 🧠 5. Command Reference: `cos sync`
**Purpose:** Bidirectional Brain Bridge (Obsidian <-> Projects).
**Syntax:** `cos sync`

### 🔄 The Sync Algorithm
1.  **Scope:** Scans `01_Projects` recursively for `.project_meta.json`.
2.  **Target:** Maps to `03_Vault\01_Active_Projects\<Project_Slug>`.
3.  **Conflict Logic (Last Write Wins):**
    *   If file exists in A but not B -> **Copy**.
    *   If file exists in both -> **Compare Modified Time**.
    *   **Safety Net:** If overwriting a file, it creates a `.bak` copy of the loser first.
4.  **Metadata Injection:** If `Idea.md` is created by `cos`, it automatically injects YAML Frontmatter for Obsidian Dataview tables.

---

## 🧹 6. Command Reference: `cos clean`
**Purpose:** The Janitor. Sorts loose files.
**Syntax:** `cos clean [flags]`

*   **Default:** `cos clean` -> Cleans `E:\Downloads` (defined in config).
*   **Targeted:** `cos clean -t "D:\Old_Desktop"` -> Cleans that specific folder.

**Sorting Rules:**
*   `.jpg, .png` -> `_Images`
*   `.mp4, .mov` -> `_Video`
*   `.zip, .rar` -> `_Archives`
*   `.exe, .msi` -> `_Installers`
*   `.pdf, .docx` -> `_Docs`

---

## 🗂 7. Command Reference: `cos sort-exports`
**Purpose:** The Portal. Files loose exports into the Timeline.
**Syntax:** `cos sort-exports`

**Workflow:**
1.  You find a random video file `Final_Render.mp4` from 2023.
2.  You drag it into `C:\CreativeOS\02_Exports\_Inbox`.
3.  You run `cos sort-exports`.
4.  **Result:** The system reads the file date (2023), creates `2023\...\Month`, and moves the file there.

---

## 🖼 8. Command Reference: `cos thumbs`
**Purpose:** The Global Gallery.
**Syntax:** `cos thumbs`

**Workflow:**
1.  Scans all `01_Projects` for `02_Assets\Thumbnails`.
2.  Copies any image found to `C:\CreativeOS\04_Global_Assets\Thumbnails_Mirror`.
3.  **Renaming:** Renames the copy to `Date_ProjectName_OriginalName.jpg`.
4.  **Result:** A flat, searchable folder containing every thumbnail you have ever designed.

---

## 🗓 Weekly Maintenance Routine (Friday Protocol)

1.  **The Cleanup:**
    *   `cos clean` (Empty your Downloads).
    *   Check `02_Exports\_Inbox`, run `cos sort-exports`.
2.  **The Brain:**
    *   `cos sync` (Update Obsidian).
3.  **The Gallery:**
    *   `cos thumbs` (Update portfolio).
4.  **The Archive:**
    *   Move any **Finished** client folders from `C:\CreativeOS\01_Projects\Clients` to `D:\OneDrive - Developer\Archive`.

---

## ⚠️ Troubleshooting & Recovery

**1. "JSONDecodeError" or "Corrupt Metadata"**
*   **Cause:** PowerShell created a file with a BOM (invisible character), or the file is empty.
*   **Fix:** The script now handles BOM automatically. If it persists, delete the `.project_meta.json` file and run `cos init` to regenerate it.

**2. "Access Denied" on Folders**
*   **Cause:** You are trying to rename a folder you are currently inside.
*   **Fix:** `cos init` was patched to *not* rename folders, only update metadata slugs.

**3. Moving to a New PC**
1.  Install Python.
2.  Copy `C:\CreativeOS\00_System` to the new C: drive.
3.  Add `C:\CreativeOS\00_System\Scripts` to Windows PATH environment variable.
4.  Run `cos`. You are live.
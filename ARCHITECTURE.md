# CreativeOS Architecture

This document describes the architecture and design decisions behind CreativeOS.

## Table of Contents

- [Overview](#overview)
- [Hub-and-Spoke Architecture](#hub-and-spoke-architecture)
- [Core Components](#core-components)
- [Data Flow](#data-flow)
- [Project Metadata](#project-metadata)
- [Commands](#commands)
- [Templates](#templates)
- [Configuration](#configuration)
- [Security Model](#security-model)
- [Design Decisions](#design-decisions)

## Overview

CreativeOS is a command-line tool for managing creative projects. It provides:

- **Project scaffolding** from templates
- **Bidirectional sync** with Obsidian vault
- **Archive workflow** for completed projects
- **Media organization** and thumbnail generation
- **Context-aware operations** that work from anywhere in a project

```
┌─────────────────────────────────────────────────────────────────┐
│                        CreativeOS                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ Projects │◄──►│  Vault   │◄──►│ Archive  │◄──►│ Shuttle  │  │
│  │  (Hub)   │    │ (Notes)  │    │ (Cold)   │    │ (Mobile) │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Templates                              │  │
│  │  Video │ Audio │ Design │ Photo │ Code │ Writing         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Hub-and-Spoke Architecture

CreativeOS uses a **hub-and-spoke** architecture with four main locations:

### Projects Path (Hub)

The central location for all active projects.

```
[projects_path]\
├── Video\
│   └── 2026-02-25_MyVideoProject\
├── Audio\
│   └── 2026-02-15_Podcast\
├── Design\
│   └── 2026-02-10_BrandRefresh\
├── Code\
│   ├── Personal_Stuff\
│   └── Clients\
└── Writing\
    └── 2026-01-25_ArticleDraft\
```

### Vault Path (Notes)

Obsidian vault for project notes. Synced bidirectionally with projects.

```
[vault_path]\
├── MyVideoProject\
│   ├── Idea.md
│   ├── Script.md
│   ├── Metadata.md
│   └── Tasks.md
└── ...
```

### Archive Path (Cold Storage)

Completed or paused projects. Preserved but not actively synced.

```
[archive_path]\
├── Video\
│   └── 2025-12-01_OldProject\
└── ...
```

### Shuttle Path (Mobile)

Removable drive for working on projects across computers.

```
[shuttle_path]\
├── Active\
│   └── MyVideoProject\
└── ToArchive\
    └── OldProject\
```

## Core Components

### Package Structure (After Refactor)

```
cos/
├── __init__.py           # Package initialization
├── config.py             # Configuration management
├── security.py           # Input sanitization, validation
├── file_utils.py         # File operations, sync, fingerprints
├── display.py            # Rich console output
└── commands/
    ├── __init__.py
    ├── new.py            # Project creation
    ├── clone.py          # Git clone wrapper
    ├── init.py           # Adopt existing directory
    ├── sync.py           # Bidirectional sync
    ├── export.py         # Export organization
    ├── thumbs.py         # Thumbnail generation
    ├── clean.py          # Cleanup operations
    ├── sort_exports.py   # Export sorting
    ├── travel.py         # Archive workflow
    └── resurrect.py      # Restore from archive
```

### Configuration Module

```python
# cos/config.py

CONFIG_PATH = Path(__file__).parent.parent.parent / "Config" / "config.json"

def load_config() -> dict:
    """Load configuration from JSON file."""
    ...

def get_path(key: str) -> Path:
    """Get a configured path, with validation."""
    ...
```

### Security Module

```python
# cos/security.py

def sanitize_path_input(value: str, max_length: int = 100) -> str:
    """Sanitize user input for use in paths."""
    ...

def validate_git_url(url: str) -> str:
    """Validate and normalize git URLs."""
    ...

def sanitize_powershell_arg(arg: str) -> str:
    """Escape PowerShell special characters."""
    ...
```

### File Utilities Module

```python
# cos/file_utils.py

def get_smart_date(path: str) -> float:
    """Get most relevant date for a path."""
    ...

def get_file_fingerprint(path: str) -> dict | None:
    """Get mtime and size for a file."""
    ...

def sync_two_folders(source: str, target: str) -> tuple[list, dict]:
    """Bidirectional sync between folders."""
    ...

def find_meta_in_cwd(max_levels: int = 3) -> Path | None:
    """Find project metadata by traversing up."""
    ...
```

## Data Flow

### Project Creation Flow

```
User Input                Template System              File System
    │                          │                          │
    │  cos new "My Video"      │                          │
    │ ─────────────────────►   │                          │
    │                          │  Copy template           │
    │                          │ ────────────────────────►│
    │                          │                          │
    │                          │  Create .project_meta.json
    │                          │ ────────────────────────►│
    │                          │                          │
    │  Success message         │                          │
    │ ◄─────────────────────   │                          │
```

### Sync Flow

```
Project Notes              Sync Engine              Vault Notes
     │                         │                         │
     │  Compare fingerprints    │                         │
     │ ◄─────────────────────►  │                         │
     │                         │                         │
     │                         │  Push new/changed files  │
     │                         │ ────────────────────────►│
     │                         │                         │
     │                         │  Pull new/changed files  │
     │                         │ ◄────────────────────────│
     │                         │                         │
     │  Updated files          │                         │
     │ ◄─────────────────────►  │                         │
```

### Archive Flow

```
Projects                   Archive                   Shuttle
    │                         │                         │
    │  cos travel             │                         │
    │ ───────────────────────►│                         │
    │                         │                         │
    │                         │  cos travel --shuttle   │
    │                         │ ───────────────────────►│
    │                         │                         │
    │  cos resurrect          │                         │
    │ ◄──────────────────────►│                         │
```

## Project Metadata

Each project has a `.project_meta.json` file that defines its "DNA":

```json
{
  "name": "My Video Project",
  "type": "Video",
  "created": "2026-02-25",
  "client": "Client Name",
  "git": "https://github.com/user/repo.git",
  "tags": ["youtube", "tutorial"],
  "status": "active",
  "version": "1.0.0"
}
```

### Metadata Discovery (3-Level Up Rule)

When running commands from within a project, CreativeOS searches for metadata:

```
[projects_path]\Video\2026-02-25_MyProject\03_Resolve\Cache\
         │
         │  Level 1: Check here
         ▼
[projects_path]\Video\2026-02-25_MyProject\
         │
         │  Level 2: Check here ✓ Found!
         ▼
[projects_path]\Video\
         │
         │  Level 3: Stop here
         ▼
[projects_path]\
```

## Commands

### Project Lifecycle Commands

| Command | Purpose | Input | Output |
|---------|---------|-------|--------|
| `new` | Create new project | Name, category | Project directory |
| `clone` | Clone git repo as project | URL, name | Project directory |
| `init` | Adopt existing directory | None | Metadata file |
| `travel` | Archive project | None | Moved to archive |
| `resurrect` | Restore from archive | Project name | Moved to projects |

### Sync Commands

| Command | Purpose | Direction |
|---------|---------|-----------| 
| `sync` | Bidirectional sync | Projects ↔ Vault |

### Organization Commands

| Command | Purpose | Input |
|---------|---------|-------|
| `export` | Organize exports | Date range |
| `thumbs` | Generate thumbnails | Project path |
| `clean` | Clean up files | Project path |
| `sort-exports` | Sort by date | Project path |

## Templates

Templates define the initial structure for new projects:

```
00_System\Templates\
│
│  ── Current ──────────────────────────────────────────
├── video_project\          # Full YouTube/video production
│   ├── 00_Notes\           # Idea.md, Script.md, Metadata.md, Tasks.md
│   ├── 01_Footage\         # A-Roll, B-Roll, Screen, Audio, Misc
│   ├── 02_Assets\          # Graphics, Thumbnails, Music, SFX
│   ├── 03_Resolve\         # Timelines, Cache, Subtitles
│   ├── 04_Previews\
│   └── 99_Archive\
├── audio_project\          # Music production
│   ├── 00_Notes\           # Lyrics.md, MixNotes.md, Ideas.md
│   ├── 01_Project_Files\   # FL_Studio, Ableton, Reaper
│   ├── 02_Stems\           # Vocals, Drums, Inst
│   ├── 03_Exports\         # MP3, WAV, Master
│   ├── 04_Samples\
│   └── 05_Ref_Tracks\
├── code_project\           # Software development
├── ai_project\             # AI/ML projects
├── auto_video\             # Automated video pipelines
├── plain_code\             # Minimal code scaffolding
├── simple\                 # Single-folder minimal project
│
│  ── Planned (Task 08.2) ──────────────────────────────
├── design_project\         # Graphic design / branding / UX
│   ├── 00_Notes\           # Brief.md, Moodboard_Links.md, Feedback.md
│   ├── 01_Assets\          # Fonts, Icons, Photos, Brand_Refs
│   ├── 02_Working_Files\   # Figma, Illustrator, Photoshop, InDesign
│   ├── 03_Exports\         # Web, Print, Social
│   └── 04_Presentations\
├── photo_project\          # Photography / Lightroom
│   ├── 00_Notes\           # Brief.md, Shot_List.md
│   ├── 01_RAW\
│   ├── 02_Selects\
│   ├── 03_Edits\           # Lightroom, Photoshop
│   └── 04_Exports\         # Web, Print, Delivery
├── writing_project\        # Articles, scripts, books
│   ├── 00_Notes\           # Brief.md, Research.md, Outline.md
│   ├── 01_Drafts\
│   ├── 02_Edits\
│   └── 03_Final\
├── podcast_project\        # Spoken word / interview episodes
│   ├── 00_Notes\           # Episode_Brief.md, Guest_Info.md, Questions.md
│   ├── 01_Recordings\      # Raw, Backup
│   ├── 02_Editing\
│   ├── 03_Assets\          # Music, SFX, Artwork
│   └── 04_Exports\         # MP3, WAV
├── client_project\         # General multi-discipline client work
│   ├── 00_Notes\           # Brief.md, Meetings.md, Tasks.md, Feedback.md
│   ├── 01_Assets\          # From_Client, Research
│   ├── 02_Working_Files\
│   ├── 03_Deliverables\
│   └── 04_Invoicing\
└── course_project\         # Video courses / educational content
    ├── 00_Notes\           # Course_Outline.md, Script_Template.md
    ├── 01_Scripts\
    ├── 02_Footage\         # Lessons, Screen_Recordings, B-Roll
    ├── 03_Assets\          # Slides, Graphics, Music
    └── 04_Exports\         # Full_Course, Clips, Previews
```

### Template Variables

Templates can include variables that are replaced during creation:

| Variable | Replaced With |
|----------|---------------|
| `{{PROJECT_NAME}}` | Project name |
| `{{DATE}}` | Creation date |
| `{{CLIENT}}` | Client name (if provided) |

## Configuration

Configuration is stored in `config.json`:

```json
{
  "root_path": "<path-to-creativeos-root>",
  "projects_path": "<root>\\01_Projects",
  "exports_path": "<root>\\02_Exports",
  "templates_path": "<root>\\00_System\\Templates",
  "vault_path": "<root>\\03_Vault",
  "downloads_path": "<your-downloads-drive>\\Downloads",
  "shuttle_path": "<removable-drive>\\CreativeOS_Shuttle",
  "archive_path": "<archive-drive>\\Archive",
  "version": "1.3"
}
```

### Configuration Loading

1. Check for `config.json` in standard location
2. Validate all paths exist
3. Cache configuration for session
4. Re-validate on each command (paths may change)

## Security Model

### Input Validation Pipeline

```
User Input
    │
    ▼
┌─────────────────┐
│ Type Validation │  Check expected type (string, int, etc.)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Sanitization    │  Remove dangerous characters
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Validation      │  Check against rules (length, format)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Path Resolution │  Resolve to absolute path
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Boundary Check  │  Ensure within allowed directories
└────────┬────────┘
         │
         ▼
    Safe Input
```

### Command Execution Security

```python
# NEVER do this
subprocess.run(f"git clone {user_url}", shell=True)

# ALWAYS do this
validated_url = validate_git_url(user_url)
subprocess.run(["git", "clone", validated_url], check=True)
```

## Design Decisions

### Why Python?

- **File system operations**: Python excels at file manipulation
- **CLI ecosystem**: Rich library provides beautiful terminal output
- **Cross-platform**: Works on Windows, macOS, Linux
- **Accessibility**: Easy for users to modify and extend

### Why Not TypeScript?

While TypeScript has advantages, Python is better suited for:
- File system heavy operations
- CLI tools with rich formatting
- Users who want to modify the tool

### Why Hub-and-Spoke?

- **Separation of concerns**: Projects, notes, archives are separate
- **Flexibility**: Each location can be on different drives
- **Obsidian integration**: Vault path enables note sync
- **Archive workflow**: Completed projects don't clutter active work

### Why Bidirectional Sync?

- **Edit anywhere**: Notes can be edited in project or Obsidian
- **No conflicts**: Newer file always wins
- **Transparency**: Users see exactly what's happening

### Why 3-Level Up Rule?

- **Convenience**: Run commands from anywhere in project
- **Safety**: Limited depth prevents finding wrong metadata
- **Performance**: No need to search entire tree

---

*Last updated: 2026-02-25*

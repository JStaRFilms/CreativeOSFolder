# 🚀 CreativeOS

<div align="center">

```
   ______                _   _            ___  ____ 
  / ____/________  ____ | | | |__   ___  / _ \/ ___|
 | |   | '__/ _ \/ _` || |_| |\ \ / / _ \| | | \___ \
 | |___| | |  __/ (_| ||  _  | \ V /  __/ |_| |___) |
  \____|_|  \___|\__,_||_| |_|  \_/ \___|\___/|____/ 
```

**The Central Nervous System for Creative Workflows**

[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](https://github.com/JStaRFilms/CreativeOSFolder)
[![Python](https://img.shields.io/badge/python-3.10+-green.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/license-MIT-purple.svg)](LICENSE)

[Installation](#-installation) • [Quick Start](#-quick-start) • [Commands](#-commands) • [Documentation](#-documentation)

</div>

---

## What is CreativeOS?

CreativeOS is a **context-aware CLI** that transforms your file system into an intelligent project management system. It bridges your active projects, Obsidian vault, archives, and portable drives through a unified command interface.

**Key Features:**
- 🎯 **Project Scaffolding** — 12 templates for Video, Code, AI, Audio, Design, Photo, Writing, Podcast, Course, and Client work
- 🔄 **Bidirectional Sync** — Seamless sync between projects and Obsidian vault
- 🧠 **Context Awareness** — Run commands from anywhere in a project (3-Level Up Rule)
- 📦 **Archive Workflow** — Move projects to cold storage and resurrect them when needed
- 🔒 **Security Hardened** — Input sanitization, path validation, and injection prevention
- ⚡ **Rich CLI** — Beautiful terminal output with progress indicators

---

## 📦 Installation

### Prerequisites

- **Python 3.10+** — [Download Python](https://www.python.org/downloads/)
- **pip** — Comes with Python

### Quick Install

```bash
# Clone the repository
git clone https://github.com/JStaRFilms/CreativeOSFolder.git
cd CreativeOSFolder

# Install dependencies
pip install -r requirements.txt

# Run the setup wizard
python -m cos.cli setup
```

### Manual Configuration

Copy the configuration template and customize paths:

```bash
cp 00_System/Config/config.template.json 00_System/Config/config.json
```

Edit `config.json` with your paths:

```json
{
  "root_path": "D:\\CreativeOS",
  "projects_path": "D:\\CreativeOS\\01_Projects",
  "vault_path": "D:\\CreativeOS\\03_Vault",
  "archive_path": "E:\\Archive",
  "shuttle_path": "F:\\Shuttle"
}
```

### Windows Integration

Add `cos.bat` to your PATH for global access:

```batch
# The batch file is already configured with relative paths
# Just add 00_System\Scripts to your PATH environment variable
```

---

## 🚀 Quick Start

### Create Your First Project

```bash
# Create a video project
cos new "My YouTube Video" -c Video

# Create a code project with Git
cos new "My App" -c Code -g

# Create a client project
cos new "Brand Refresh" -c Design --client "Acme Corp"
```

### Adopt an Existing Folder

```bash
cd path/to/existing/project
cos init
```

### Sync Notes with Obsidian

```bash
cos sync
```

---

## 📋 Commands

### Project Lifecycle

| Command | Description | Example |
|---------|-------------|---------|
| `new` | Create a new project from template | `cos new "Video Project" -c Video` |
| `clone` | Clone a Git repo as a project | `cos clone https://github.com/user/repo.git` |
| `init` | Adopt current directory as a project | `cos init` |
| `travel` | Move project to shuttle drive | `cos travel` |
| `resurrect` | Restore project from archive | `cos resurrect "Old Project"` |

### Synchronization

| Command | Description | Example |
|---------|-------------|---------|
| `sync` | Bidirectional sync with Obsidian vault | `cos sync` |

### Organization

| Command | Description | Example |
|---------|-------------|---------|
| `clean` | Sort Downloads folder by file type | `cos clean` |
| `sort-exports` | Organize exports by date | `cos sort-exports` |
| `thumbs` | Generate thumbnail gallery | `cos thumbs` |
| `export` | Open exports folder | `cos export` |

### Configuration

| Command | Description | Example |
|---------|-------------|---------|
| `setup` | Run setup wizard | `cos setup` |
| `config` | View/edit configuration | `cos config --list` |
| `category` | Manage project categories | `cos category list` |

### Help

| Command | Description | Example |
|---------|-------------|---------|
| `help` | Show help for commands | `cos help new` |
| `--help` | Command-specific help | `cos new --help` |

---

## 🎨 Categories & Templates

CreativeOS ships with 12 project categories, each with optimized templates:

| Category | Icon | Template | Description |
|----------|------|----------|-------------|
| Video | 🎬 | `video_project` | YouTube, film, video production |
| Code | 💻 | `plain_code` | Software development |
| Audio | 🎵 | `audio_project` | Music and audio production |
| AI | 🤖 | `ai_project` | Machine learning and AI projects |
| Design | 🎨 | `design_project` | Graphic design and branding |
| Photo | 📷 | `photo_project` | Photography projects |
| Writing | ✍️ | `writing_project` | Articles, blogs, books |
| Podcast | 🎙️ | `podcast_project` | Podcast production |
| Course | 📚 | `course_project` | Online course creation |
| Client | 👥 | `client_project` | Multi-discipline client work |

### Category Aliases

```bash
# These are equivalent
cos new "Project" -c Web    # → Code category
cos new "Project" -c ML     # → AI category
cos new "Project" -c Blog   # → Writing category
```

---

## 🧠 Core Concepts

### Hub-and-Spoke Architecture

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

- **Projects Path** — Active workspace for current projects
- **Vault Path** — Obsidian vault for notes and knowledge base
- **Archive Path** — Cold storage for completed projects
- **Shuttle Path** — External drive for portable work

### Project Metadata (`.project_meta.json`)

Every project has a metadata file that defines its "DNA":

```json
{
  "name": "My Video Project",
  "type": "Video",
  "created": "2026-02-25",
  "client": "Client Name",
  "git": "https://github.com/user/repo.git",
  "tags": ["youtube", "tutorial"],
  "status": "active"
}
```

### The 3-Level Up Rule

Run commands from anywhere inside a project:

```
P:\Active\Video\2023_Nike_Ad\04_Exports\Social_Media\Revisions\
         │
         │  cos export
         ▼
    Searches upward for .project_meta.json
    Found at: P:\Active\Video\2023_Nike_Ad\
```

---

## 🔧 Command Reference

### `cos new` — Create Project

```bash
cos new <name> [options]

Arguments:
  name                    Project name (required)

Options:
  -c, --category CATEGORY Category: Video, Code, AI, Audio, Design, Photo, Writing, Podcast, Course, Client
                          Default: Video
  --client CLIENT         Associate with a client (creates client subfolder)
  -d, --date DATE         Backdate project (YYYY-MM-DD)
  -g, --git               Initialize Git repository
  -s, --simple            Use minimal folder structure

Examples:
  cos new "YouTube Tutorial" -c Video -g
  cos new "Mobile App" -c Code --client "Acme Corp" -g
  cos new "Podcast Episode 5" -c Podcast -d 2026-01-15
```

### `cos clone` — Clone Repository

```bash
cos clone <url> [options]

Arguments:
  url                     Git repository URL (required)

Options:
  -n, --name NAME         Override folder name
  -c, --category CATEGORY Category (default: Code)
  --client CLIENT         Associate with a client

Examples:
  cos clone https://github.com/user/repo.git
  cos clone https://github.com/user/repo.git -n "My Project" -c AI
```

### `cos sync` — Bidirectional Sync

```bash
cos sync

Synchronizes 00_Notes folders between projects and Obsidian vault:
  • New in Project → Push to Vault
  • New in Vault → Pull to Project
  • Conflict → Newer file wins (with backup)
```

### `cos travel` — Archive Project

```bash
cos travel

Moves project to shuttle drive for portable work.
Creates _TRAVEL_LOG.txt with sync timestamp.
```

### `cos resurrect` — Restore Project

```bash
cos resurrect <name>

Searches archive for project and restores to active projects.
Reads .project_meta.json to determine original location.
```

---

## 🛡️ Security

CreativeOS v2.1.0 includes comprehensive security hardening:

- **Input Sanitization** — All user inputs are sanitized for safe path construction
- **Git URL Validation** — Prevents flag injection in clone operations
- **PowerShell Sanitization** — Escapes special characters in shell commands
- **Path Boundary Checks** — Validates paths stay within trusted directories
- **Secure File Permissions** — Restricts access to configuration files

See [SECURITY.md](SECURITY.md) for details.

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [USER MANUAL.md](USER%20MANUAL.md) | Comprehensive command reference |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture and design decisions |
| [CHANGELOG.md](CHANGELOG.md) | Version history and changes |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines |
| [SECURITY.md](SECURITY.md) | Security policy |

---

## 🧪 Development

### Setup Development Environment

```bash
# Clone and install dev dependencies
git clone https://github.com/JStaRFilms/CreativeOSFolder.git
cd CreativeOSFolder
pip install -e ".[dev]"
```

### Run Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=cos

# Type checking
mypy 00_System/Scripts/cos

# Linting
ruff check 00_System/Scripts/cos
```

### Project Structure

```
CreativeOS/
├── 00_System/
│   ├── Config/
│   │   ├── config.json          # User configuration
│   │   ├── config.template.json # Configuration template
│   │   └── categories.json      # Category definitions
│   ├── Scripts/
│   │   ├── cos/                 # Main package
│   │   │   ├── cli.py           # CLI entry point
│   │   │   ├── config.py        # Configuration management
│   │   │   ├── security.py      # Input validation
│   │   │   ├── file_utils.py    # File operations
│   │   │   └── commands/        # Command implementations
│   │   └── tests/               # Test suite
│   └── Templates/               # Project templates
├── pyproject.toml               # Package metadata
├── requirements.txt             # Dependencies
└── README.md                    # This file
```

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [Rich](https://github.com/Textualize/rich) for beautiful terminal output
- Inspired by the need for a unified creative workflow system

---

<div align="center">

**[⬆ Back to Top](#-creativeos)**

Made with ❤️ by Oluleke-Oke Goodness THE GOAT!

</div>

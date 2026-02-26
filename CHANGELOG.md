# CreativeOS — Changelog

> **Your Creative Nervous System** · Version history

All notable changes to CreativeOS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

*(Nothing pending yet — all production readiness changes shipped in v2.1.0)*

---

## [2.1.0] - 2026-02-25

### Added
- Input sanitization for project names and paths
- Git URL validation to prevent flag injection
- PowerShell command sanitization
- Secure file permissions for sensitive files
- Type hints throughout codebase
- Comprehensive Google-style docstrings
- Unit and integration test suites (`tests/unit/`, `tests/integration/`)
- `pyproject.toml` for modern Python packaging
- Python version constraint (`.python-version` → `3.10`)
- Configuration template (`config.template.json`)
- Central error handler with Rich formatting and `error.log`
- Python `logging` framework with rotating log file (`creativeos.log`)
- CLI argument validation (`validate_project_name`, `validate_client_name`, `validate_date`)
- Path validation for `.project_meta.json` files against trusted boundaries

### Changed
- Refactored monolithic `manage.py` into modular `cos/` package structure
- Improved performance of `get_smart_date()` with directory pruning for excluded dirs
- Fixed duplicate code in `get_date_slug()` sync operations
- Made `cos.bat` portable — replaced hardcoded paths with `%~dp0` relative paths
- Updated `.gitignore` with comprehensive Python, IDE, and tool patterns

### Fixed
- Path traversal vulnerability in project creation
- Command injection in git clone operations
- PowerShell injection in export commands
- Performance freeze on large projects with `node_modules` or `.git` directories
- Duplicate line bug in `get_date_slug()`

### Security
- Added input validation for all user-provided CLI values
- Implemented `sanitize_path_input()` to prevent traversal attacks
- Added `validate_git_url()` to prevent flag injection in clone operations
- Secured file permissions for configuration files

---

## [1.0.0] - 2026-02-25

### Added
- Initial release of CreativeOS
- Core commands: `new`, `clone`, `init`, `sync`, `export`, `thumbs`, `clean`, `sort-exports`, `travel`, `resurrect`
- Project templates: Video, Audio, Design, Photo, Code, Writing
- Hub-and-spoke architecture with Projects, Vault, Archive, and Shuttle paths
- Bidirectional sync between projects and Obsidian vault
- Smart date detection for project organization
- Project metadata system (`.project_meta.json`)
- Context-aware operations (3-Level Up rule)
- Thumbnail generation for media projects
- Export organization by date
- Archive and resurrection workflow
- Rich CLI with beautiful terminal output
- Configuration system (`config.json`)
- Presets for common project types

### Documentation
- `README.md` with installation and usage guide
- `USER MANUAL.md` with comprehensive command reference

---

## Version History Summary

| Version | Date       | Description                          |
|---------|------------|--------------------------------------|
| 1.0.0   | 2026-02-25 | Initial release                      |
| 2.1.0   | 2026-02-25 | Production readiness & hardening     |

---

[Unreleased]: https://github.com/JStaRFilms/CreativeOSFolder/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/JStaRFilms/CreativeOSFolder/compare/v1.0.0...v2.1.0
[1.0.0]: https://github.com/JStaRFilms/CreativeOSFolder/releases/tag/v1.0.0

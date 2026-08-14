"""Cached, non-destructive storage inventory for CreativeOS projects."""

from __future__ import annotations

import datetime as dt
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Iterable

from .config import EXCLUDED_DIRS, PROJECTS_PATH, STORAGE_INDEX_PATH
from .file_utils import robust_rmtree

INDEX_VERSION = 1
REMINDER_INTERVAL_DAYS = 7
DEFAULT_STALE_DAYS = 90

# These folders are safe to regenerate from a project's source/configuration.
REGENERABLE_DIRS = {
    "node_modules",
    ".next",
    ".nuxt",
    "dist",
    "build",
    "coverage",
    ".cache",
    ".pytest_cache",
    ".mypy_cache",
    "__pycache__",
    "target",
    "out",
    "test-results",
    ".venv",
    "venv",
    "env",
}

REGENERABLE_DESCRIPTIONS = {
    "node_modules": "Node.js Dependencies · Reinstall via npm/pnpm",
    ".next": "Next.js Build Cache · Regenerated on build",
    ".nuxt": "Nuxt Build Cache · Regenerated on build",
    "dist": "Compiled Distribution Build · Regenerated on build",
    "build": "Compiled Build Artifacts · Regenerated on build",
    "coverage": "Test Coverage Reports · Regenerated on test run",
    ".cache": "Framework / Tooling Cache · Regenerated automatically",
    ".pytest_cache": "Pytest Cache · Regenerated on pytest run",
    ".mypy_cache": "Mypy Type Checking Cache · Regenerated on mypy run",
    "__pycache__": "Python Bytecode Cache · Regenerated on execution",
    "target": "Rust / Cargo Build Target · Regenerated on cargo build",
    "out": "Static Export Output · Regenerated on export",
    "test-results": "Test Runner Artifacts · Regenerated on test run",
    ".venv": "Python Virtual Environment · Recreate via python -m venv",
    "venv": "Python Virtual Environment · Recreate via python -m venv",
    "env": "Python Virtual Environment · Recreate via python -m venv",
}

MEDIA_EXTENSIONS = {
    ".3gp", ".aac", ".aif", ".aiff", ".avi", ".bmp", ".cr2", ".cr3",
    ".dng", ".flac", ".gif", ".heic", ".jpeg", ".jpg", ".m4a", ".mkv",
    ".mov", ".mp3", ".mp4", ".mpeg", ".mpg", ".nef", ".ogg", ".opus",
    ".png", ".psd", ".raw", ".tif", ".tiff", ".wav", ".webm", ".webp",
    ".wmv",
}


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _iso(timestamp: float) -> str:
    return dt.datetime.fromtimestamp(timestamp, tz=dt.timezone.utc).isoformat()


def _parse_iso(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.timezone.utc)
    except ValueError:
        return None


def format_bytes(size: int) -> str:
    """Format a byte count for a compact, human-readable table."""
    if size < 1024:
        return f"{size} B"
    units = ("KB", "MB", "GB", "TB", "PB")
    amount = float(size)
    for unit in units:
        amount /= 1024
        if amount < 1024 or unit == units[-1]:
            return f"{amount:.1f} {unit}"
    return f"{amount:.1f} PB"


def _is_link_or_junction(path: Path) -> bool:
    """Detect symlinks *and* NTFS junctions (which is_symlink misses on Windows)."""
    return path.is_symlink() or path.is_junction()


def _safe_stat(path: Path) -> os.stat_result | None:
    try:
        return path.stat()
    except OSError:
        return None


def _created_date(project: Path, metadata: dict[str, Any]) -> tuple[str, str]:
    """Use CreativeOS metadata first, then the best filesystem fallback."""
    created = metadata.get("created")
    if isinstance(created, str):
        try:
            return dt.date.fromisoformat(created[:10]).isoformat(), "metadata"
        except ValueError:
            pass

    stat_result = _safe_stat(project)
    if stat_result is None:
        return "Unknown", "unavailable"

    birthtime = getattr(stat_result, "st_birthtime", None)
    timestamp = birthtime if birthtime is not None else stat_result.st_ctime
    return _iso(timestamp)[:10], "filesystem"


VCS_DIRS = {".git", ".svn", ".hg"}


def _contains_any(parts: Iterable[str], names: set[str]) -> bool:
    return any(part in names for part in parts)


def inspect_project(
    project: Path,
    metadata: dict[str, Any],
    projects_path: str | Path | None = None,
) -> dict[str, Any]:
    """Measure one project without following links or changing the filesystem."""
    total_size = 0
    reclaimable_size = 0
    media_size = 0
    file_count = 0
    meaningful_latest: float | None = None
    unreadable_files = 0

    stack: list[tuple[Path, bool, bool]] = [(project, False, False)]

    while stack:
        current_dir, in_reclaimable, in_excluded = stack.pop()
        try:
            with os.scandir(current_dir) as it:
                for entry in it:
                    try:
                        if entry.is_symlink():
                            continue

                        name = entry.name
                        if entry.is_dir(follow_symlinks=False):
                            if name in VCS_DIRS:
                                continue
                            try:
                                if Path(entry.path).is_junction():
                                    continue
                            except Exception:
                                pass

                            child_reclaimable = in_reclaimable or (name in REGENERABLE_DIRS)
                            child_excluded = in_excluded or (name in EXCLUDED_DIRS)
                            stack.append((Path(entry.path), child_reclaimable, child_excluded))

                        elif entry.is_file(follow_symlinks=False):
                            stat_res = entry.stat(follow_symlinks=False)
                            size = stat_res.st_size
                            mtime = stat_res.st_mtime

                            file_count += 1
                            total_size += size

                            if in_reclaimable:
                                reclaimable_size += size
                            else:
                                _, ext = os.path.splitext(name)
                                if ext.lower() in MEDIA_EXTENSIONS:
                                    media_size += size

                            if not in_excluded and not in_reclaimable:
                                if meaningful_latest is None or mtime > meaningful_latest:
                                    meaningful_latest = mtime

                    except (OSError, PermissionError):
                        unreadable_files += 1
                        continue
        except (OSError, PermissionError):
            unreadable_files += 1
            continue

    project_stat = _safe_stat(project)
    if meaningful_latest is None and project_stat is not None:
        meaningful_latest = project_stat.st_mtime

    created, created_source = _created_date(project, metadata)
    return {
        "name": metadata.get("name") or project.name,
        "type": metadata.get("type") or "Unknown",
        "path": str(project),
        "relative_path": project.relative_to(Path(projects_path or PROJECTS_PATH)).as_posix(),
        "created": created,
        "created_source": created_source,
        "last_meaningful_update": _iso(meaningful_latest) if meaningful_latest else None,
        "total_size": total_size,
        "reclaimable_size": reclaimable_size,
        "media_size": media_size,
        "file_count": file_count,
        "unreadable_files": unreadable_files,
    }


def discover_projects(projects_path: str | Path | None = None) -> list[tuple[Path, dict[str, Any]]]:
    """Return initialized project roots below the configured projects directory."""
    root = Path(projects_path or PROJECTS_PATH)
    if not root.is_dir():
        return []

    projects: list[tuple[Path, dict[str, Any]]] = []
    for current_root, dirs, files in os.walk(root, topdown=True, followlinks=False):
        current = Path(current_root)
        dirs[:] = [
            name for name in dirs
            if name not in EXCLUDED_DIRS and not _is_link_or_junction(current / name)
        ]
        if ".project_meta.json" not in files:
            continue

        metadata_path = current / ".project_meta.json"
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8-sig"))
        except (OSError, json.JSONDecodeError):
            # A malformed metadata file cannot safely identify a project.
            dirs[:] = []
            continue

        if not isinstance(metadata, dict):
            dirs[:] = []
            continue
        projects.append((current, metadata))
        # A CreativeOS project owns its descendants; do not list nested folders twice.
        dirs[:] = []
    return projects


def build_storage_index(projects_path: str | Path | None = None) -> dict[str, Any]:
    """Create a complete inventory. This is intentionally read-only."""
    root = Path(projects_path or PROJECTS_PATH)
    projects = [
        inspect_project(path, metadata, root)
        for path, metadata in discover_projects(root)
    ]
    projects.sort(key=lambda project: project["total_size"], reverse=True)
    return {
        "version": INDEX_VERSION,
        "scanned_at": _utc_now().isoformat(),
        "projects_path": str(root),
        "project_count": len(projects),
        "total_size": sum(project["total_size"] for project in projects),
        "reclaimable_size": sum(project["reclaimable_size"] for project in projects),
        "media_size": sum(project["media_size"] for project in projects),
        "projects": projects,
    }


def load_storage_index(
    index_path: str | Path | None = None,
    projects_path: str | Path | None = None,
) -> dict[str, Any] | None:
    """Load the prior inventory, returning ``None`` if it is absent, invalid, or mismatched."""
    path = Path(index_path or STORAGE_INDEX_PATH)
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(loaded, dict) or loaded.get("version") != INDEX_VERSION:
        return None
    if not isinstance(loaded.get("projects"), list):
        return None
    
    # Only validate projects_path match if caller explicitly provided projects_path,
    # or if using the default global storage index.
    if index_path is None or projects_path is not None:
        expected_root = str(Path(projects_path or PROJECTS_PATH).resolve())
        cached_root = loaded.get("projects_path")
        if cached_root:
            try:
                if str(Path(cached_root).resolve()) != expected_root:
                    return None
            except Exception:
                return None

    return loaded




def save_storage_index(index: dict[str, Any], index_path: str | Path | None = None) -> Path:
    """Atomically persist the inventory so normal commands never read a partial scan."""
    path = Path(index_path or STORAGE_INDEX_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(index, handle, indent=2, sort_keys=True)
            handle.write("\n")
        os.replace(temporary_name, path)
    except Exception:
        try:
            os.unlink(temporary_name)
        except OSError:
            pass
        raise
    return path


def refresh_storage_index(
    projects_path: str | Path | None = None,
    index_path: str | Path | None = None,
) -> dict[str, Any]:
    """Scan and persist a new inventory, preserving opt-in reminder settings."""
    prior_index = load_storage_index(index_path)
    index = build_storage_index(projects_path)
    if prior_index and prior_index.get("reminders_enabled"):
        index["reminders_enabled"] = True
        if prior_index.get("last_reminded_at"):
            index["last_reminded_at"] = prior_index["last_reminded_at"]
    save_storage_index(index, index_path)
    return index


def _recalculate_totals(index: dict[str, Any]) -> None:
    """Recompute aggregate fields from the project list."""
    projects = index.get("projects", [])
    index["project_count"] = len(projects)
    index["total_size"] = sum(p.get("total_size", 0) for p in projects)
    index["reclaimable_size"] = sum(p.get("reclaimable_size", 0) for p in projects)
    index["media_size"] = sum(p.get("media_size", 0) for p in projects)


def update_project_in_storage_index(
    project_path: str | Path,
    metadata: dict[str, Any] | None = None,
    projects_path: str | Path | None = None,
    index_path: str | Path | None = None,
) -> dict[str, Any]:
    """Inspect a single project and incrementally update its record in the storage index.
    
    This avoids expensive re-scanning of the entire workspace when only one project changes.
    """
    root = Path(projects_path or PROJECTS_PATH).resolve()
    proj = Path(project_path)
    if not proj.is_absolute():
        proj = root / proj
    proj = proj.resolve()

    index = load_storage_index(index_path=index_path, projects_path=root)
    if index is None:
        return refresh_storage_index(projects_path=root, index_path=index_path)

    if not proj.is_dir():
        return remove_project_from_storage_index(proj, projects_path=root, index_path=index_path)

    if metadata is None:
        meta_file = proj / ".project_meta.json"
        if meta_file.exists():
            try:
                metadata = json.loads(meta_file.read_text(encoding="utf-8-sig"))
            except Exception:
                metadata = {}
        else:
            metadata = {}

    # Inspect just this single project
    project_record = inspect_project(proj, metadata, root)
    proj_str = str(proj)

    # Replace existing or append
    projects = [p for p in index.get("projects", []) if p.get("path") != proj_str]
    projects.append(project_record)
    projects.sort(key=lambda p: p.get("total_size", 0), reverse=True)

    index["projects"] = projects
    index["scanned_at"] = _utc_now().isoformat()
    _recalculate_totals(index)
    save_storage_index(index, index_path)
    return index


def remove_project_from_storage_index(
    project_path: str | Path,
    projects_path: str | Path | None = None,
    index_path: str | Path | None = None,
) -> dict[str, Any]:
    """Remove a single project (e.g. archived, deleted, or moved) from the cached storage index."""
    root = Path(projects_path or PROJECTS_PATH).resolve()
    proj = Path(project_path)
    if not proj.is_absolute():
        proj = root / proj
    proj_str = str(proj.resolve())

    index = load_storage_index(index_path=index_path, projects_path=root)
    if index is None:
        return refresh_storage_index(projects_path=root, index_path=index_path)

    projects = [p for p in index.get("projects", []) if p.get("path") != proj_str]
    index["projects"] = projects
    index["scanned_at"] = _utc_now().isoformat()
    _recalculate_totals(index)
    save_storage_index(index, index_path)
    return index


def refresh_partial(
    scope_path: str | Path,
    projects_path: str | Path | None = None,
    index_path: str | Path | None = None,
) -> tuple[dict[str, Any], int]:
    """Re-scan only projects under *scope_path* and merge into the cached index.

    Returns ``(index, count)`` where *count* is how many projects were rescanned.
    If no cached index exists, falls back to a full scan.
    """
    root = Path(projects_path or PROJECTS_PATH).resolve()
    scope = Path(scope_path)

    # Resolve relative paths against the projects root.
    if not scope.is_absolute():
        scope = root / scope
    scope = scope.resolve()

    # Fast path: if scope is a single project directory with .project_meta.json
    if (scope / ".project_meta.json").is_file():
        idx = update_project_in_storage_index(scope, projects_path=root, index_path=index_path)
        return idx, 1

    prior_index = load_storage_index(index_path, projects_path=root)
    if prior_index is None:
        # No cache — must do a full scan anyway.
        return refresh_storage_index(projects_path, index_path), -1

    # Discover and scan only the projects that live under scope.
    scoped = [
        (path, metadata)
        for path, metadata in discover_projects(root)
        if path.resolve().is_relative_to(scope)
    ]
    rescanned = [inspect_project(path, metadata, root) for path, metadata in scoped]

    # Build a set of rescanned paths for replacement lookup.
    rescanned_paths = {p["path"] for p in rescanned}

    # Merge: keep untouched projects, replace rescanned ones.
    merged = [p for p in prior_index.get("projects", []) if p["path"] not in rescanned_paths]
    merged.extend(rescanned)
    merged.sort(key=lambda p: p.get("total_size", 0), reverse=True)

    prior_index["projects"] = merged
    prior_index["scanned_at"] = _utc_now().isoformat()
    _recalculate_totals(prior_index)
    save_storage_index(prior_index, index_path)
    return prior_index, len(rescanned)


def set_reminders_enabled(enabled: bool, index_path: str | Path | None = None) -> None:
    """Persist reminder consent without scanning or performing any cleanup."""
    index = load_storage_index(index_path) or {
        "version": INDEX_VERSION,
        "projects": [],
        "project_count": 0,
        "total_size": 0,
        "reclaimable_size": 0,
        "media_size": 0,
    }
    index["reminders_enabled"] = enabled
    if not enabled:
        index.pop("last_reminded_at", None)
    save_storage_index(index, index_path)


def stale_projects(index: dict[str, Any], stale_days: int = DEFAULT_STALE_DAYS) -> list[dict[str, Any]]:
    """Return projects whose meaningful activity predates the supplied threshold."""
    cutoff = _utc_now() - dt.timedelta(days=stale_days)
    stale: list[dict[str, Any]] = []
    for project in index.get("projects", []):
        activity = _parse_iso(project.get("last_meaningful_update"))
        if activity is not None and activity < cutoff:
            stale.append(project)
    return stale


def reminder_is_due(index: dict[str, Any]) -> bool:
    """Determine whether a read-only CLI reminder may be shown."""
    if not index.get("reminders_enabled") or not index.get("scanned_at"):
        return False
    last_reminded = _parse_iso(index.get("last_reminded_at"))
    return last_reminded is None or _utc_now() - last_reminded >= dt.timedelta(days=REMINDER_INTERVAL_DAYS)


def mark_reminded(index: dict[str, Any], index_path: str | Path | None = None) -> None:
    """Record a displayed reminder; this updates only the small JSON cache."""
    index["last_reminded_at"] = _utc_now().isoformat()
    save_storage_index(index, index_path)


def find_project_reclaimable_dirs(project_path: str | Path) -> list[dict[str, Any]]:
    """Scan a project and return a detailed list of all regenerable directories found."""
    p_root = Path(project_path).resolve()
    if not p_root.is_dir():
        return []

    items: list[dict[str, Any]] = []

    for root, dirs, _ in os.walk(p_root, topdown=True, followlinks=False):
        curr = Path(root)
        dirs_to_check = list(dirs)
        for d in dirs_to_check:
            if d in REGENERABLE_DIRS:
                dir_path = curr / d
                d_size = 0
                d_files = 0
                try:
                    for sub_root, _, sub_files in os.walk(dir_path, followlinks=False):
                        for f in sub_files:
                            f_path = Path(sub_root) / f
                            try:
                                if not f_path.is_symlink():
                                    d_size += f_path.stat(follow_symlinks=False).st_size
                                    d_files += 1
                            except Exception:
                                pass
                except Exception:
                    pass

                try:
                    rel_to_proj = dir_path.relative_to(p_root).as_posix()
                except Exception:
                    rel_to_proj = d

                desc = REGENERABLE_DESCRIPTIONS.get(d, "Regenerable Cache / Dependency Folder")
                items.append({
                    "name": d,
                    "relative_path": rel_to_proj,
                    "path": str(dir_path),
                    "size": d_size,
                    "file_count": d_files,
                    "description": desc,
                })
                # Don't descend into child folders of a regenerable directory
                if d in dirs:
                    dirs.remove(d)

    items.sort(key=lambda x: x["size"], reverse=True)
    return items


def reclaim_project_space(
    project_path: str | Path,
    target_subdirs: list[str] | None = None,
    projects_path: str | Path | None = None,
    index_path: str | Path | None = None,
) -> dict[str, Any]:
    """Safely delete regenerable directories from a project and update the storage index."""
    p_root = Path(project_path).resolve()
    if not p_root.is_dir():
        raise FileNotFoundError(f"Project directory not found: {project_path}")

    all_reclaimable = find_project_reclaimable_dirs(p_root)
    if target_subdirs is not None:
        target_set = {t.strip().replace("\\", "/").rstrip("/").lower() for t in target_subdirs if t.strip()}
        selected = [
            item for item in all_reclaimable
            if item["relative_path"].lower() in target_set or item["name"].lower() in target_set
        ]
    else:
        selected = all_reclaimable

    freed_bytes = 0
    freed_files = 0
    purged: list[str] = []
    errors: list[str] = []

    for item in selected:
        d_path = Path(item["path"])
        # Safety verification: ensure directory is strictly inside project root and name is in REGENERABLE_DIRS
        if not d_path.resolve().is_relative_to(p_root):
            continue
        if d_path.name not in REGENERABLE_DIRS:
            continue

        if d_path.exists():
            item_size = item["size"]
            item_files = item["file_count"]
            if robust_rmtree(str(d_path)):
                freed_bytes += item_size
                freed_files += item_files
                purged.append(item["relative_path"])
            else:
                errors.append(f"Could not remove {item['relative_path']}")

    # Rescan this project and update storage index
    try:
        refresh_partial(p_root, projects_path=projects_path, index_path=index_path)
    except Exception:
        pass

    return {
        "status": "success" if not errors else "partial_success",
        "freed_bytes": freed_bytes,
        "freed_files": freed_files,
        "purged_directories": purged,
        "errors": errors,
        "remaining_reclaimable": sum(it["size"] for it in find_project_reclaimable_dirs(p_root)),
    }


def reclaim_bulk_space(
    stale_only: bool = False,
    days: int = DEFAULT_STALE_DAYS,
    project_paths: list[str] | None = None,
    projects_path: str | Path | None = None,
    index_path: str | Path | None = None,
) -> dict[str, Any]:
    """Reclaim regenerable space across multiple projects."""
    root = Path(projects_path or PROJECTS_PATH).resolve()
    index = load_storage_index(index_path, projects_path=root) or build_storage_index(root)

    if project_paths:
        target_path_set = {str(Path(p).resolve()) for p in project_paths}
        target_name_set = {p.lower().strip() for p in project_paths}
        candidate_projects = [
            p for p in index.get("projects", [])
            if str(Path(p["path"]).resolve()) in target_path_set or
               (p.get("slug") and p.get("slug").lower() in target_name_set) or
               (p.get("name") and p.get("name").lower() in target_name_set)
        ]
    elif stale_only:
        candidate_projects = stale_projects(index, stale_days=days)
    else:
        candidate_projects = [p for p in index.get("projects", []) if p.get("reclaimable_size", 0) > 0]

    total_freed = 0
    total_files = 0
    cleaned_projects: list[dict[str, Any]] = []
    log_entries: list[dict[str, Any]] = []

    for proj in candidate_projects:
        p_path = Path(proj["path"])
        if not p_path.is_dir():
            continue

        reclaimable_items = find_project_reclaimable_dirs(p_path)
        if not reclaimable_items:
            continue

        proj_freed = 0
        proj_purged = []
        for item in reclaimable_items:
            d_path = Path(item["path"])
            if d_path.exists() and d_path.name in REGENERABLE_DIRS and d_path.resolve().is_relative_to(p_path.resolve()):
                size = item["size"]
                file_count = item["file_count"]
                if robust_rmtree(str(d_path)):
                    proj_freed += size
                    total_freed += size
                    total_files += file_count
                    proj_purged.append(item["relative_path"])
                    log_entries.append({
                        "project": proj.get("name", p_path.name),
                        "folder": item["relative_path"],
                        "freed_bytes": size,
                        "status": "purged",
                    })

        if proj_purged:
            cleaned_projects.append({
                "name": proj.get("name", p_path.name),
                "slug": proj.get("slug", p_path.name),
                "path": str(p_path),
                "freed_bytes": proj_freed,
                "purged_directories": proj_purged,
            })

    # Global re-scan to refresh the entire storage index
    new_index = refresh_storage_index(projects_path=root, index_path=index_path)

    return {
        "status": "success",
        "total_freed_bytes": total_freed,
        "total_files": total_files,
        "projects_cleaned_count": len(cleaned_projects),
        "cleaned_projects": cleaned_projects,
        "log_entries": log_entries,
        "new_storage_summary": {
            "total_size": new_index.get("total_size", 0),
            "reclaimable_size": new_index.get("reclaimable_size", 0),
            "media_size": new_index.get("media_size", 0),
        },
    }

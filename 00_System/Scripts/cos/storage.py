"""Cached, non-destructive storage inventory for CreativeOS projects."""

from __future__ import annotations

import datetime as dt
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Iterable

from .config import EXCLUDED_DIRS, PROJECTS_PATH, STORAGE_INDEX_PATH

INDEX_VERSION = 1
REMINDER_INTERVAL_DAYS = 7
DEFAULT_STALE_DAYS = 90

# These folders are safe to regenerate from a project's source/configuration.
# They are measured separately, but this module never removes them.
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

    for root, dirs, files in os.walk(project, topdown=True, followlinks=False):
        root_path = Path(root)
        try:
            relative_parts = root_path.relative_to(project).parts
        except ValueError:
            relative_parts = ()

        # Never traverse a symlink or NTFS junction: they may point outside
        # the project and cause massive over-counting (pnpm junctions, etc.).
        dirs[:] = [name for name in dirs if not _is_link_or_junction(root_path / name)]

        for filename in files:
            file_path = root_path / filename
            if file_path.is_symlink():
                continue
            stat_result = _safe_stat(file_path)
            if stat_result is None:
                unreadable_files += 1
                continue

            size = stat_result.st_size
            file_count += 1
            total_size += size
            path_parts = relative_parts + (filename,)
            is_reclaimable = _contains_any(path_parts, REGENERABLE_DIRS)
            is_excluded_from_activity = _contains_any(path_parts, EXCLUDED_DIRS)

            if is_reclaimable:
                reclaimable_size += size
            if file_path.suffix.lower() in MEDIA_EXTENSIONS:
                media_size += size
            if not is_excluded_from_activity:
                meaningful_latest = max(meaningful_latest or stat_result.st_mtime, stat_result.st_mtime)

    project_stat = _safe_stat(project)
    if meaningful_latest is None and project_stat is not None:
        meaningful_latest = project_stat.st_mtime

    created, created_source = _created_date(project, metadata)
    return {
        "name": metadata.get("name") or project.name,
        "type": metadata.get("type") or "Unknown",
        "path": str(project),
        "relative_path": str(project.relative_to(Path(projects_path or PROJECTS_PATH))),
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


def load_storage_index(index_path: str | Path | None = None) -> dict[str, Any] | None:
    """Load the prior inventory, returning ``None`` if it is absent or invalid."""
    path = Path(index_path or STORAGE_INDEX_PATH)
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(loaded, dict) or loaded.get("version") != INDEX_VERSION:
        return None
    if not isinstance(loaded.get("projects"), list):
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


def refresh_partial(
    scope_path: str | Path,
    projects_path: str | Path | None = None,
    index_path: str | Path | None = None,
) -> tuple[dict[str, Any], int]:
    """Re-scan only projects under *scope_path* and merge into the cached index.

    Returns ``(index, count)`` where *count* is how many projects were rescanned.
    If no cached index exists, falls back to a full scan.
    """
    root = Path(projects_path or PROJECTS_PATH)
    scope = Path(scope_path)

    # Resolve relative paths against the projects root.
    if not scope.is_absolute():
        scope = root / scope
    scope = scope.resolve()

    prior_index = load_storage_index(index_path)
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

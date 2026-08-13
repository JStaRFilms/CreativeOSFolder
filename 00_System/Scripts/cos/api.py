"""FastAPI backend API wrapper for CreativeOS GUI."""

from __future__ import annotations

import os
import sys
import json
import shutil
import datetime
import subprocess
from pathlib import Path
from typing import Any, Optional
from pydantic import BaseModel, Field

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import __version__
from .config import (
    CONFIG_PATH,
    PROJECTS_PATH,
    ROOT_PATH,
    TEMPLATES_PATH,
    VAULT_PATH,
    EXPORTS_PATH,
    DOWNLOADS_PATH,
    SHUTTLE_PATH,
    ARCHIVE_PATH,
    _load_config,
    reload_config,
    logger,
)
from .category_config import (
    get_categories,
    get_enabled_categories,
    get_category_icon,
    get_default_category,
    get_simple_template,
)
from .storage import (
    DEFAULT_STALE_DAYS,
    _created_date,
    build_storage_index,
    discover_projects,
    inspect_project,
    load_storage_index,
    refresh_storage_index,
    stale_projects,
)
from .security import sanitize_path_input, validate_client_name
from .file_utils import robust_rmtree
from .commands.new import create_project_structure
from .commands.sync import run_sync, stream_sync

app = FastAPI(
    title="CreativeOS API",
    description="Lightweight API backend for CreativeOS GUI",
    version=__version__,
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────────────────────────
# Security Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _get_allowed_roots() -> list[Path]:
    """Return all permitted filesystem roots for CreativeOS operations."""
    roots: list[Path] = []
    candidates = [
        ROOT_PATH,
        PROJECTS_PATH,
        EXPORTS_PATH,
        VAULT_PATH,
        DOWNLOADS_PATH,
        SHUTTLE_PATH,
        ARCHIVE_PATH,
    ]
    for p in candidates:
        if p and isinstance(p, str):
            try:
                roots.append(Path(p).resolve())
            except Exception:
                pass
    return roots


def _check_path_allowed(target_path: str | Path) -> Path:
    """Verify that a path is strictly inside allowed workspace boundaries."""
    try:
        resolved = Path(target_path).resolve()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid path: {e}",
        )

    allowed = _get_allowed_roots()
    is_safe = any(
        resolved == root or root in resolved.parents
        for root in allowed
    )
    if not is_safe:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Target path is outside permitted workspace roots: {resolved}",
        )
    return resolved


def _find_project_dir(project_name: str, search_root: str | None = None) -> tuple[Path, dict[str, Any]]:
    """Locate a project directory and its metadata by slug, name, or relative path."""
    root = search_root or PROJECTS_PATH
    search_name = project_name.lower().strip()

    # 1. Direct subpath check
    candidate = Path(root) / project_name
    if candidate.is_dir() and (candidate / ".project_meta.json").is_file():
        try:
            with open(candidate / ".project_meta.json", "r", encoding="utf-8-sig") as f:
                return candidate, json.load(f)
        except Exception:
            pass

    # 2. Search through discovered projects
    discovered = discover_projects(root)
    for proj_path, meta in discovered:
        p_name = (meta.get("name") or "").lower()
        p_slug = (meta.get("slug") or "").lower()
        p_dir = proj_path.name.lower()
        try:
            p_rel = proj_path.relative_to(Path(root)).as_posix().lower()
        except Exception:
            p_rel = ""

        if search_name in (p_name, p_slug, p_dir, p_rel):
            return proj_path, meta

    # 3. Partial match fallback
    for proj_path, meta in discovered:
        p_name = (meta.get("name") or "").lower()
        p_slug = (meta.get("slug") or "").lower()
        p_dir = proj_path.name.lower()
        if search_name in p_name or search_name in p_slug or search_name in p_dir:
            return proj_path, meta

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Project '{project_name}' not found",
    )


# ──────────────────────────────────────────────────────────────────────────────
# Pydantic Request Models
# ──────────────────────────────────────────────────────────────────────────────

class CreateProjectRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Project name")
    category: str = Field(default="Video", description="Project category")
    client: Optional[str] = Field(default=None, max_length=50, description="Optional client name")
    destination_subpath: Optional[str] = Field(default=None, description="Optional custom subfolder path relative to projects root")
    date: Optional[str] = Field(default=None, description="Optional creation date (YYYY-MM-DD)")
    simple: bool = Field(default=False, description="Use minimal template")
    git: bool = Field(default=False, description="Initialize Git repository")


class UpdatePathsRequest(BaseModel):
    paths: dict[str, str] = Field(..., description="Dictionary of path keys and new filesystem paths")
    move_files: bool = Field(default=False, description="Whether to migrate files to new location")


class UpdateProjectRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100, description="Updated project name")
    client: Optional[str] = Field(default=None, max_length=50, description="Updated client name")
    category: Optional[str] = Field(default=None, description="Updated category/type")
    description: Optional[str] = Field(default=None, description="Project summary description")
    tags: Optional[list[str]] = Field(default=None, description="Project tags")
    status: Optional[str] = Field(default=None, description="Project workflow status")
    custom_meta: Optional[dict[str, Any]] = Field(default=None, description="Additional custom metadata")
    sync_filesystem: bool = Field(default=False, description="Rename or move the physical project folder on disk")



class OpenPathRequest(BaseModel):
    path: str = Field(..., min_length=1, description="Path to open with native OS handler")


# ──────────────────────────────────────────────────────────────────────────────
# Core API Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def get_health() -> dict[str, Any]:
    """Health check endpoint."""
    return {
        "status": "ok",
        "version": __version__,
        "projects_path": PROJECTS_PATH,
        "vault_path": VAULT_PATH,
        "exports_path": EXPORTS_PATH,
        "archive_path": ARCHIVE_PATH,
        "shuttle_path": SHUTTLE_PATH,
    }


# Server in-memory caching
_PROJECTS_CACHE: dict[str, Any] = {"data": None, "time": 0.0}
_CACHE_TTL_SECONDS = 5.0

def _invalidate_server_cache() -> None:
    """Clear memory caches when projects are mutated."""
    _PROJECTS_CACHE["data"] = None
    _PROJECTS_CACHE["time"] = 0.0


@app.get("/api/projects")
def get_projects(nocache: bool = False) -> list[dict[str, Any]]:
    """List all CreativeOS projects with metadata, status, and size metrics."""
    now = datetime.datetime.now().timestamp()
    if not nocache and _PROJECTS_CACHE["data"] is not None and (now - _PROJECTS_CACHE["time"]) < _CACHE_TTL_SECONDS:
        return _PROJECTS_CACHE["data"]

    cached_index = load_storage_index(projects_path=PROJECTS_PATH)
    cached_map: dict[str, Any] = {}
    stale_set = set()

    if cached_index:
        cached_map = {p["path"]: p for p in cached_index.get("projects", [])}
        stale_set = {p["path"] for p in stale_projects(cached_index, DEFAULT_STALE_DAYS)}

    discovered = discover_projects(PROJECTS_PATH)
    project_list: list[dict[str, Any]] = []

    for proj_path, metadata in discovered:
        path_str = str(proj_path)
        cat = metadata.get("type") or "Video"
        cached = cached_map.get(path_str)

        try:
            rel_path = proj_path.relative_to(Path(PROJECTS_PATH)).as_posix()
        except Exception:
            rel_path = proj_path.name

        if cached:
            item = {
                **cached,
                "name": metadata.get("name") or cached.get("name") or proj_path.name,
                "type": cat,
                "client": metadata.get("client") or cached.get("client") or "None",
                "description": metadata.get("description") or cached.get("description") or "",
                "tags": metadata.get("tags") or cached.get("tags") or [],
                "relative_path": rel_path,
                "icon": get_category_icon(cat),
                "is_stale": path_str in stale_set,
                "status": "stale" if path_str in stale_set else "active",
            }
        else:
            created, created_source = _created_date(proj_path, metadata)
            item = {
                "name": metadata.get("name") or proj_path.name,
                "slug": metadata.get("slug") or proj_path.name,
                "type": cat,
                "client": metadata.get("client") or "None",
                "description": metadata.get("description") or "",
                "tags": metadata.get("tags") or [],
                "path": path_str,
                "relative_path": rel_path,
                "created": created,
                "created_source": created_source,
                "last_meaningful_update": None,
                "total_size": 0,
                "reclaimable_size": 0,
                "media_size": 0,
                "file_count": 0,
                "icon": get_category_icon(cat),
                "is_stale": False,
                "status": "active",
            }
        project_list.append(item)

    project_list.sort(key=lambda p: p.get("created") or "", reverse=True)
    _PROJECTS_CACHE["data"] = project_list
    _PROJECTS_CACHE["time"] = now
    return project_list



@app.post("/api/projects", status_code=status.HTTP_201_CREATED)
def create_project(req: CreateProjectRequest) -> dict[str, Any]:
    """Create a new CreativeOS project via existing logic."""
    try:
        meta = create_project_structure(
            name=req.name,
            category=req.category,
            client=req.client,
            destination_subpath=req.destination_subpath,
            date=req.date,
            simple=req.simple,
            git=req.git,
        )
        _invalidate_server_cache()
        return {
            "status": "success",
            "message": f"Project '{req.name}' created successfully",
            "project": meta,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except FileExistsError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        ) from e
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e
    except Exception as e:
        logger.error(f"Error creating project from GUI: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create project: {e}",
        ) from e


def _compute_new_project_path(current_proj_path: Path, new_name: str, new_client: str, new_category: str) -> tuple[Path, str]:
    """Compute target project directory and slug based on updated name, client, and category."""
    original_dirname = current_proj_path.name
    date_prefix = ""
    if len(original_dirname) >= 11 and original_dirname[4] == "-" and original_dirname[7] == "-" and original_dirname[10] == "_":
        date_prefix = original_dirname[:11]

    clean_name = sanitize_path_input(new_name, max_length=100)
    slugified_name = clean_name.replace(" ", "_")
    new_dir_name = f"{date_prefix}{slugified_name}" if date_prefix else slugified_name

    if new_client and new_client.lower() != "none" and new_client.lower() != "internal":
        clean_client = validate_client_name(new_client.strip())
        target_parent = Path(PROJECTS_PATH) / "Clients" / clean_client
    else:
        clean_cat = new_category.strip() or "Video"
        target_parent = Path(PROJECTS_PATH) / clean_cat

    target_path = target_parent / new_dir_name
    return target_path, slugified_name


@app.put("/api/projects/{project_name}")
def update_project(project_name: str, req: UpdateProjectRequest) -> dict[str, Any]:
    """Update project metadata (.project_meta.json) and optionally sync filesystem on disk."""
    proj_path, meta = _find_project_dir(project_name)
    meta_file = proj_path / ".project_meta.json"

    if req.name is not None:
        clean_name = sanitize_path_input(req.name, max_length=100)
        meta["name"] = clean_name

    if req.client is not None:
        client_clean = req.client.strip()
        if client_clean and client_clean.lower() != "none" and client_clean.lower() != "internal":
            meta["client"] = validate_client_name(client_clean)
        else:
            meta["client"] = "None"

    if req.category is not None:
        meta["type"] = req.category.strip()

    if req.description is not None:
        meta["description"] = req.description.strip()

    if req.tags is not None:
        meta["tags"] = [str(t).strip() for t in req.tags if str(t).strip()]

    if req.status is not None:
        meta["status"] = req.status.strip()

    if req.custom_meta is not None and isinstance(req.custom_meta, dict):
        for k, v in req.custom_meta.items():
            meta[k] = v

    meta["last_updated"] = datetime.datetime.now().isoformat()

    # Move or rename directory on disk if requested
    moved_disk = False
    if req.sync_filesystem:
        target_path, new_slug = _compute_new_project_path(
            proj_path,
            new_name=meta.get("name", project_name),
            new_client=meta.get("client", "None"),
            new_category=meta.get("type", "Video"),
        )
        target_resolved = target_path.resolve()
        current_resolved = proj_path.resolve()

        if target_resolved != current_resolved:
            if target_resolved.exists():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Target folder already exists on disk: {target_resolved}",
                )

            target_resolved.parent.mkdir(parents=True, exist_ok=True)
            old_parent = current_resolved.parent
            try:
                shutil.move(str(current_resolved), str(target_resolved))
                proj_path = target_resolved
                meta_file = target_resolved / ".project_meta.json"
                meta["slug"] = new_slug
                moved_disk = True

                # Clean up empty parent client folder if left behind
                try:
                    if old_parent != Path(PROJECTS_PATH) and old_parent.exists():
                        if not any(old_parent.iterdir()):
                            old_parent.rmdir()
                except Exception:
                    pass
            except Exception as e:
                logger.error(f"Failed to move project on disk: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to move project folder on disk: {e}",
                ) from e

    try:
        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Failed to write metadata for {project_name}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update metadata file: {e}",
        ) from e

    try:
        rel_path = proj_path.relative_to(Path(PROJECTS_PATH)).as_posix()
    except Exception:
        rel_path = proj_path.name

    _invalidate_server_cache()

    return {
        "status": "success",
        "message": f"Project '{meta.get('name', project_name)}' updated{' and moved on disk' if moved_disk else ''} successfully",
        "project": {
            **meta,
            "path": str(proj_path),
            "relative_path": rel_path,
        },
        "moved": moved_disk,
        "new_path": str(proj_path),
    }


# ──────────────────────────────────────────────────────────────────────────────
# File Explorer Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/api/fs/list")
def list_fs(path: Optional[str] = None) -> dict[str, Any]:
    """List directory contents with security boundary checks, folders first."""
    if not path or path.strip() in ("", "."):
        target_dir = Path(PROJECTS_PATH).resolve()
    else:
        p_str = path.strip()
        p = Path(p_str)
        if not p.is_absolute():
            candidate = (Path(PROJECTS_PATH) / p).resolve()
            if candidate.exists():
                target_dir = candidate
            else:
                target_dir = (Path(ROOT_PATH) / p).resolve()
        else:
            target_dir = p.resolve()

    target_dir = _check_path_allowed(target_dir)

    if not target_dir.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Path not found: {path}")
    if not target_dir.is_dir():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Path is not a directory: {path}")

    entries = []
    try:
        with os.scandir(target_dir) as it:
            for entry in it:
                if entry.name.startswith(".") and entry.name != ".project_meta.json":
                    continue
                try:
                    stat_res = entry.stat()
                    is_dir = entry.is_dir(follow_symlinks=False)
                    ext = Path(entry.name).suffix.lower() if not is_dir else ""
                    mtime_iso = datetime.datetime.fromtimestamp(stat_res.st_mtime).isoformat()
                    size_bytes = stat_res.st_size if not is_dir else 0

                    entries.append({
                        "name": entry.name,
                        "path": str(Path(entry.path).resolve()),
                        "is_dir": is_dir,
                        "size": size_bytes,
                        "type": "directory" if is_dir else (ext[1:] if ext else "file"),
                        "extension": ext,
                        "modified": mtime_iso,
                    })
                except (OSError, PermissionError):
                    continue
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Permission denied: {e}")

    # Sort folders first (alphabetical), then files (alphabetical)
    entries.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))

    # Determine parent path if within allowed bounds
    parent_path = None
    if target_dir.parent != target_dir:
        try:
            _check_path_allowed(target_dir.parent)
            parent_path = str(target_dir.parent)
        except HTTPException:
            parent_path = None

    # Calculate friendly relative path
    rel_display = target_dir.name
    for root in _get_allowed_roots():
        try:
            rel = target_dir.relative_to(root)
            rel_display = rel.as_posix() if str(rel) != "." else root.name
            break
        except Exception:
            pass

    return {
        "current_path": str(target_dir),
        "name": target_dir.name or str(target_dir),
        "relative_display": rel_display,
        "parent_path": parent_path,
        "entries": entries,
    }


@app.post("/api/fs/open")
def open_fs_path(req: OpenPathRequest) -> dict[str, Any]:
    """Open a file or directory using the OS native handler."""
    p_str = req.path.strip()
    p = Path(p_str)
    if not p.is_absolute():
        candidate = (Path(PROJECTS_PATH) / p).resolve()
        if candidate.exists():
            target = candidate
        else:
            target = (Path(ROOT_PATH) / p).resolve()
    else:
        target = p.resolve()

    target = _check_path_allowed(target)

    if not target.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Path does not exist: {req.path}")

    try:
        if sys.platform == "win32":
            os.startfile(str(target))
        elif sys.platform == "darwin":
            subprocess.run(["open", str(target)], check=False)
        else:
            subprocess.run(["xdg-open", str(target)], check=False)
        return {
            "status": "success",
            "message": f"Opened '{target.name}' natively",
            "path": str(target),
        }
    except Exception as e:
        logger.error(f"Failed to open native handler for {target}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not open path natively: {e}",
        ) from e


# ──────────────────────────────────────────────────────────────────────────────
# Travel, Archive & Resurrect Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@app.post("/api/projects/{project_name}/travel")
def travel_project(project_name: str) -> dict[str, Any]:
    """Copy active project to configured Shuttle Drive."""
    proj_path, meta = _find_project_dir(project_name)
    shuttle_root = SHUTTLE_PATH
    if not shuttle_root:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Shuttle path is not configured in config.json",
        )

    if not os.path.exists(shuttle_root):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shuttle Drive path not found at: {shuttle_root}. Please connect the external drive.",
        )

    try:
        rel_path = proj_path.relative_to(Path(PROJECTS_PATH)).as_posix()
    except Exception:
        rel_path = proj_path.name

    dest_path = Path(shuttle_root) / "Projects" / rel_path
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        shutil.copytree(proj_path, dest_path, dirs_exist_ok=True)
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_file = dest_path / "_TRAVEL_LOG.txt"
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(f"Synced from Desktop at: {timestamp}\n")
        return {
            "status": "success",
            "message": f"Project ready for travel at {dest_path}",
            "dest_path": str(dest_path),
            "project": meta,
        }
    except Exception as e:
        logger.error(f"Error copying to shuttle: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to copy project to Shuttle: {e}",
        ) from e


@app.post("/api/projects/{project_name}/archive")
def archive_project(project_name: str) -> dict[str, Any]:
    """Move active project from Projects tree to Cold Archive."""
    proj_path, meta = _find_project_dir(project_name)
    archive_root = ARCHIVE_PATH
    if not archive_root:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archive path is not configured in config.json",
        )

    try:
        os.makedirs(archive_root, exist_ok=True)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cannot access or create Archive directory: {e}",
        ) from e

    category = meta.get("type", "Video")
    client = meta.get("client")
    if client and client != "None":
        dest_dir = Path(archive_root) / "Clients" / client / proj_path.name
    else:
        dest_dir = Path(archive_root) / category / proj_path.name

    dest_dir.parent.mkdir(parents=True, exist_ok=True)

    if dest_dir.exists():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Project already exists in Archive at: {dest_dir}",
        )

    try:
        shutil.copytree(proj_path, dest_dir)
        if not robust_rmtree(str(proj_path)):
            logger.warning(f"Could not cleanly remove source project {proj_path} after copy to archive.")

        try:
            refresh_storage_index()
        except Exception:
            pass

        _invalidate_server_cache()
        return {
            "status": "success",
            "message": f"Project '{meta.get('name', project_name)}' moved to Archive",
            "archive_path": str(dest_dir),
            "project": meta,
        }
    except Exception as e:
        logger.error(f"Error archiving project: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Archiving failed: {e}",
        ) from e


@app.get("/api/projects/archived")
def get_archived_projects() -> list[dict[str, Any]]:
    """List all archived projects located in ARCHIVE_PATH."""
    archive_root = ARCHIVE_PATH
    if not archive_root or not os.path.exists(archive_root):
        return []

    discovered = discover_projects(archive_root)
    archived_list: list[dict[str, Any]] = []

    for proj_path, metadata in discovered:
        path_str = str(proj_path)
        cat = metadata.get("type") or "Video"
        try:
            rel_path = proj_path.relative_to(Path(archive_root)).as_posix()
        except Exception:
            rel_path = proj_path.name

        created, created_source = _created_date(proj_path, metadata)
        archived_list.append({
            "name": metadata.get("name") or proj_path.name,
            "slug": metadata.get("slug") or proj_path.name,
            "type": cat,
            "client": metadata.get("client") or "None",
            "description": metadata.get("description") or "",
            "path": path_str,
            "relative_path": rel_path,
            "created": created,
            "created_source": created_source,
            "icon": get_category_icon(cat),
            "is_archived": True,
        })

    archived_list.sort(key=lambda p: p.get("created") or "", reverse=True)
    return archived_list


@app.post("/api/projects/{project_name}/resurrect")
def resurrect_project(project_name: str) -> dict[str, Any]:
    """Restore an archived project from Archive back to active Projects tree."""
    archive_root = ARCHIVE_PATH
    if not archive_root or not os.path.exists(archive_root):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Archive path not found at: {archive_root}",
        )

    proj_path, meta = _find_project_dir(project_name, search_root=archive_root)

    category = meta.get("type", "Video")
    client = meta.get("client")
    if client and client != "None":
        dest_root = Path(PROJECTS_PATH) / "Clients" / client
    else:
        cat_lower = category.lower()
        if cat_lower in ["web", "code", "dev"]:
            dest_cat = "Code"
        elif cat_lower in ["music", "audio"]:
            dest_cat = "Music"
        elif cat_lower == "ai":
            dest_cat = "AI"
        elif cat_lower == "design":
            dest_cat = "Design"
        elif cat_lower == "photo":
            dest_cat = "Photo"
        elif cat_lower == "writing":
            dest_cat = "Writing"
        elif cat_lower == "podcast":
            dest_cat = "Podcast"
        elif cat_lower == "course":
            dest_cat = "Course"
        else:
            dest_cat = "Video"
        dest_root = Path(PROJECTS_PATH) / dest_cat

    dest_root.mkdir(parents=True, exist_ok=True)
    final_dest = dest_root / proj_path.name

    if final_dest.exists():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Project already exists in Active Projects at: {final_dest}",
        )

    try:
        shutil.copytree(proj_path, final_dest)
        if not robust_rmtree(str(proj_path)):
            logger.warning(f"Could not completely remove {proj_path} from archive after restoring.")

        try:
            refresh_storage_index()
        except Exception:
            pass

        _invalidate_server_cache()
        return {
            "status": "success",
            "message": f"Project '{meta.get('name', project_name)}' resurrected successfully to {final_dest}",
            "path": str(final_dest),
            "project": meta,
        }
    except Exception as e:
        logger.error(f"Error resurrecting project: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Resurrection failed: {e}",
        ) from e


# ──────────────────────────────────────────────────────────────────────────────
# Storage & Config Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/api/storage")
def get_storage() -> dict[str, Any]:
    """Retrieve current storage inventory and statistics."""
    index = load_storage_index(projects_path=PROJECTS_PATH)
    if index is None:
        projects = get_projects()
        index = {
            "version": 1,
            "scanned_at": None,
            "projects_path": PROJECTS_PATH,
            "project_count": len(projects),
            "total_size": sum(p.get("total_size", 0) for p in projects),
            "reclaimable_size": sum(p.get("reclaimable_size", 0) for p in projects),
            "media_size": sum(p.get("media_size", 0) for p in projects),
            "projects": projects,
        }

    stale_list = stale_projects(index, DEFAULT_STALE_DAYS)
    return {
        **index,
        "stale_count": len(stale_list),
        "stale_days_threshold": DEFAULT_STALE_DAYS,
    }


@app.post("/api/storage/refresh")
def refresh_storage() -> dict[str, Any]:
    """Trigger a full rescan of project storage and return updated inventory."""
    updated = refresh_storage_index()
    stale_list = stale_projects(updated, DEFAULT_STALE_DAYS)
    return {
        **updated,
        "stale_count": len(stale_list),
        "stale_days_threshold": DEFAULT_STALE_DAYS,
    }


def _load_template_structures() -> dict[str, Any]:
    """Load structure.json for all templates."""
    structures: dict[str, Any] = {}
    templates_dir = Path(TEMPLATES_PATH)
    if templates_dir.exists():
        for item in templates_dir.iterdir():
            if item.is_dir():
                s_file = item / "structure.json"
                if s_file.exists():
                    try:
                        with open(s_file, "r", encoding="utf-8") as f:
                            structures[item.name] = json.load(f)
                    except Exception:
                        pass
    return structures


@app.get("/api/categories")
def get_categories_endpoint() -> dict[str, Any]:
    """Get all dynamic categories, enabled list, icons, and real template structures."""
    all_cats = get_categories()
    enabled_cats = get_enabled_categories()
    templates = _load_template_structures()

    enriched_cats = {}
    for cat_name, cat_data in all_cats.items():
        t_name = cat_data.get("template", "")
        t_struct = templates.get(t_name, {})
        enriched_cats[cat_name] = {
            **cat_data,
            "template_structure": t_struct,
        }

    return {
        "categories": enriched_cats,
        "enabled": enabled_cats,
        "default_category": get_default_category(),
        "simple_template": get_simple_template(),
        "simple_structure": templates.get(get_simple_template(), {"00_Notes": ["Notes.md", "Client_Links.md"]}),
        "template_structures": templates,
    }


@app.get("/api/config")
def get_config_endpoint() -> dict[str, Any]:
    """Get system configuration and path statuses."""
    raw_config = _load_config()
    paths_status: dict[str, Any] = {}

    for key, val in raw_config.items():
        if key.endswith("_path") and isinstance(val, str):
            paths_status[key] = {
                "path": val,
                "exists": os.path.exists(val),
            }

    return {
        "config": raw_config,
        "paths": paths_status,
        "version": __version__,
    }


@app.put("/api/config/paths")
def update_config_paths(req: UpdatePathsRequest) -> dict[str, Any]:
    """Update configured system directory paths with optional migration."""
    config = _load_config()
    allowed_keys = {
        "vault_path", "exports_path", "archive_path", "shuttle_path", "downloads_path", "projects_path"
    }

    migrated = []
    for key, new_path_str in req.paths.items():
        if key not in allowed_keys:
            continue
        new_path_str = new_path_str.strip()
        if not new_path_str:
            continue

        old_path_str = config.get(key)
        new_path = Path(new_path_str)

        if req.move_files and old_path_str and old_path_str != new_path_str and os.path.exists(old_path_str):
            try:
                new_path.mkdir(parents=True, exist_ok=True)
                for item in Path(old_path_str).iterdir():
                    dest = new_path / item.name
                    if not dest.exists():
                        if item.is_dir():
                            shutil.copytree(item, dest)
                        else:
                            shutil.copy2(item, dest)
                migrated.append(f"{key}: {old_path_str} -> {new_path_str}")
            except Exception as e:
                logger.warning(f"Could not migrate files for {key}: {e}")
        else:
            try:
                new_path.mkdir(parents=True, exist_ok=True)
            except Exception:
                pass

        config[key] = str(new_path)

    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=4)

    reload_config()
    _invalidate_server_cache()

    return {
        "status": "success",
        "message": "System paths updated successfully",
        "config": config,
        "migrated": migrated,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Note Sync (JSON & SSE Stream)
# ──────────────────────────────────────────────────────────────────────────────

@app.post("/api/sync")
def trigger_sync() -> dict[str, Any]:
    """Trigger bidirectional sync between projects and Obsidian vault."""
    try:
        res = run_sync()
        return {
            "status": "success",
            **res,
        }
    except Exception as e:
        logger.error(f"Error executing sync from API: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sync failed: {e}",
        ) from e


@app.get("/api/sync/stream")
def sync_stream_endpoint() -> StreamingResponse:
    """Stream real-time Server-Sent Events (SSE) for note sync operations."""
    def sse_generator():
        try:
            for event_data in stream_sync():
                payload = json.dumps(event_data)
                yield f"data: {payload}\n\n"
        except Exception as err:
            logger.error(f"Error during SSE sync stream: {err}")
            err_payload = json.dumps({"event": "error", "message": str(err)})
            yield f"data: {err_payload}\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ──────────────────────────────────────────────────────────────────────────────
# Static files & Single-Page Application (SPA) Serving
# ──────────────────────────────────────────────────────────────────────────────

GUI_DIST_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "GUI", "dist")
)

def _setup_spa_routes():
    if os.path.isdir(GUI_DIST_DIR):
        assets_dir = os.path.join(GUI_DIST_DIR, "assets")
        if os.path.isdir(assets_dir):
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str):
            if full_path.startswith("api/"):
                raise HTTPException(status_code=404, detail="API route not found")
            target_file = os.path.join(GUI_DIST_DIR, full_path)
            if full_path and os.path.isfile(target_file):
                return FileResponse(target_file)
            index_file = os.path.join(GUI_DIST_DIR, "index.html")
            if os.path.isfile(index_file):
                return FileResponse(index_file)
            return HTMLResponse("<h1>CreativeOS GUI</h1><p>index.html not found in dist</p>")
    else:
        @app.get("/")
        def serve_dev_placeholder():
            return HTMLResponse("""<!DOCTYPE html>
<html>
<head>
    <title>CreativeOS GUI (Dev Mode)</title>
    <style>
        body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .box { background: #1e293b; padding: 2rem; border-radius: 8px; border: 1px solid #334155; max-width: 500px; text-align: center; }
        h1 { margin-top: 0; color: #38bdf8; }
        code { background: #0f172a; padding: 0.2rem 0.5rem; border-radius: 4px; color: #a5f3fc; }
    </style>
</head>
<body>
    <div class="box">
        <h1>CreativeOS GUI</h1>
        <p>Frontend production bundle is building.</p>
        <p>Run <code>cd 00_System/GUI && npm run build</code> to generate the bundle.</p>
        <p><a href="/docs" style="color: #38bdf8;">View Swagger API Docs &rarr;</a></p>
    </div>
</body>
</html>""")

_setup_spa_routes()

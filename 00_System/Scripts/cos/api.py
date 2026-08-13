"""FastAPI backend API wrapper for CreativeOS GUI."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional
from pydantic import BaseModel, Field

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from . import __version__
from .config import (
    CONFIG_PATH,
    PROJECTS_PATH,
    ROOT_PATH,
    VAULT_PATH,
    _load_config,
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
from .commands.new import create_project_structure
from .commands.sync import run_sync

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
# Pydantic Request Models
# ──────────────────────────────────────────────────────────────────────────────

class CreateProjectRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Project name")
    category: str = Field(default="Video", description="Project category")
    client: Optional[str] = Field(default=None, max_length=50, description="Optional client name")
    date: Optional[str] = Field(default=None, description="Optional creation date (YYYY-MM-DD)")
    simple: bool = Field(default=False, description="Use minimal template")
    git: bool = Field(default=False, description="Initialize Git repository")


# ──────────────────────────────────────────────────────────────────────────────
# API Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def get_health() -> dict[str, Any]:
    """Health check endpoint."""
    return {
        "status": "ok",
        "version": __version__,
        "projects_path": PROJECTS_PATH,
        "vault_path": VAULT_PATH,
    }


@app.get("/api/projects")
def get_projects() -> list[dict[str, Any]]:
    """List all CreativeOS projects with metadata, status, and size metrics."""
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
    return project_list


@app.post("/api/projects", status_code=status.HTTP_201_CREATED)
def create_project(req: CreateProjectRequest) -> dict[str, Any]:
    """Create a new CreativeOS project via existing logic."""
    try:
        meta = create_project_structure(
            name=req.name,
            category=req.category,
            client=req.client,
            date=req.date,
            simple=req.simple,
            git=req.git,
        )
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


@app.get("/api/categories")
def get_categories_endpoint() -> dict[str, Any]:
    """Get all dynamic categories, enabled list, and icons."""
    all_cats = get_categories()
    enabled_cats = get_enabled_categories()
    return {
        "categories": all_cats,
        "enabled": enabled_cats,
        "default_category": get_default_category(),
        "simple_template": get_simple_template(),
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

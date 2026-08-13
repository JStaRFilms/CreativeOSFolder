"""Tests for the cached, non-destructive storage inventory."""

import json
import os
import time
from pathlib import Path

from cos import storage


def _create_project(root: Path, name: str = "Storage Project") -> Path:
    project = root / "Video" / "2024-01-01_Storage_Project"
    project.mkdir(parents=True)
    (project / ".project_meta.json").write_text(
        json.dumps({
            "name": name,
            "slug": "2024-01-01_Storage_Project",
            "type": "Video",
            "created": "2024-01-01",
        }),
        encoding="utf-8",
    )
    return project


def test_inventory_measures_media_and_regenerable_folders(temp_projects_dir):
    """Node modules count toward space but not last meaningful activity."""
    project = _create_project(temp_projects_dir)
    source = project / "00_Notes" / "idea.md"
    source.parent.mkdir()
    source.write_bytes(b"note")

    footage = project / "01_Footage" / "clip.mp4"
    footage.parent.mkdir()
    footage.write_bytes(b"video-data")

    modules = project / "node_modules" / "package" / "index.js"
    modules.parent.mkdir(parents=True)
    modules.write_bytes(b"dependency")

    old_time = time.time() - 10 * 24 * 60 * 60
    newer_generated_time = time.time() - 60
    for file_path in (project / ".project_meta.json", source, footage):
        os.utime(file_path, (old_time, old_time))
    os.utime(modules, (newer_generated_time, newer_generated_time))

    index = storage.build_storage_index(temp_projects_dir)

    assert index["project_count"] == 1
    record = index["projects"][0]
    assert record["created"] == "2024-01-01"
    assert record["total_size"] == len(b"notevideo-datadependency") + (project / ".project_meta.json").stat().st_size
    assert record["media_size"] == len(b"video-data")
    assert record["reclaimable_size"] == len(b"dependency")
    assert record["last_meaningful_update"] != storage._iso(newer_generated_time)
    assert record["relative_path"] == "Video/2024-01-01_Storage_Project"


def test_discovery_does_not_count_nested_metadata_as_a_second_project(temp_projects_dir):
    project = _create_project(temp_projects_dir)
    nested = project / "reference" / ".project_meta.json"
    nested.parent.mkdir()
    nested.write_text("{}", encoding="utf-8")

    discovered = storage.discover_projects(temp_projects_dir)

    assert [path for path, _ in discovered] == [project]


def test_refresh_persists_index_and_reminder_consent(temp_projects_dir, temp_dir):
    _create_project(temp_projects_dir)
    index_path = temp_dir / "storage_index.json"

    first = storage.refresh_storage_index(temp_projects_dir, index_path)
    storage.set_reminders_enabled(True, index_path)
    second = storage.refresh_storage_index(temp_projects_dir, index_path)

    loaded = storage.load_storage_index(index_path)
    assert first["project_count"] == 1
    assert second["reminders_enabled"] is True
    assert loaded is not None
    assert loaded["projects_path"] == str(temp_projects_dir)
    assert loaded["reminders_enabled"] is True


def test_stale_projects_uses_meaningful_activity_date():
    index = {
        "projects": [
            {"name": "old", "last_meaningful_update": "2020-01-01T00:00:00+00:00"},
            {"name": "new", "last_meaningful_update": storage._utc_now().isoformat()},
            {"name": "unknown", "last_meaningful_update": None},
        ]
    }

    assert [project["name"] for project in storage.stale_projects(index, 90)] == ["old"]


def test_load_invalid_index_returns_none(temp_dir):
    index_path = temp_dir / "bad-index.json"
    index_path.write_text("not-json", encoding="utf-8")

    assert storage.load_storage_index(index_path) is None

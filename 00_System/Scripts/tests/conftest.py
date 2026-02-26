"""
Pytest fixtures for CreativeOS tests.

Provides common fixtures for testing without affecting real data.
"""

import pytest
import tempfile
import shutil
import json
import os
from pathlib import Path


@pytest.fixture
def temp_dir():
    """Create a temporary directory that is cleaned up after the test."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def temp_projects_dir(temp_dir):
    """Create a temporary projects directory structure."""
    projects_path = temp_dir / "01_Projects"
    projects_path.mkdir()
    
    # Create category directories
    (projects_path / "Video").mkdir()
    (projects_path / "Code").mkdir()
    (projects_path / "AI").mkdir()
    (projects_path / "Music").mkdir()
    (projects_path / "Clients").mkdir()
    
    yield projects_path


@pytest.fixture
def temp_config(temp_dir, temp_projects_dir):
    """Create a temporary config file for testing."""
    config = {
        "root_path": str(temp_dir),
        "projects_path": str(temp_projects_dir),
        "exports_path": str(temp_dir / "02_Exports"),
        "templates_path": str(temp_dir / "00_System" / "Templates"),
        "vault_path": str(temp_dir / "03_Vault"),
        "downloads_path": str(temp_dir / "Downloads"),
        "shuttle_path": str(temp_dir / "Shuttle"),
        "archive_path": str(temp_dir / "Archive"),
        "version": "2.1.0"
    }
    
    # Create config directory and file
    config_dir = temp_dir / "00_System" / "Config"
    config_dir.mkdir(parents=True)
    config_path = config_dir / "config.json"
    
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=4)
    
    yield config_path


@pytest.fixture
def sample_project(temp_projects_dir):
    """Create a sample project with metadata for testing."""
    project_path = temp_projects_dir / "Video" / "2026-02-25_Test_Project"
    project_path.mkdir(parents=True)
    
    # Create metadata
    meta = {
        "name": "Test Project",
        "slug": "2026-02-25_Test_Project",
        "type": "Video",
        "created": "2026-02-25",
        "client": "None",
        "template": "video_project",
        "root": str(project_path)
    }
    
    with open(project_path / ".project_meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=4)
    
    # Create notes directory
    notes_dir = project_path / "00_Notes"
    notes_dir.mkdir()
    
    with open(notes_dir / "Idea.md", "w", encoding="utf-8") as f:
        f.write("# Test Project\n\nThis is a test project.\n")
    
    yield project_path


@pytest.fixture
def sample_templates(temp_dir):
    """Create sample project templates for testing."""
    templates_path = temp_dir / "00_System" / "Templates"
    templates_path.mkdir(parents=True)
    
    # Simple template
    simple_template = templates_path / "simple"
    simple_template.mkdir()
    with open(simple_template / "structure.json", "w", encoding="utf-8") as f:
        json.dump({"00_Notes": ["Notes.md"]}, f)
    
    # Video template
    video_template = templates_path / "video_project"
    video_template.mkdir()
    with open(video_template / "structure.json", "w", encoding="utf-8") as f:
        json.dump({
            "00_Notes": ["Idea.md", "Script.md"],
            "01_Footage": ["A-Roll", "B-Roll"],
            "02_Assets": ["Graphics", "Thumbnails"],
            "03_Resolve": [],
            "04_Previews": []
        }, f)
    
    yield templates_path


@pytest.fixture
def mock_console():
    """Mock console for testing output without printing."""
    from unittest.mock import MagicMock
    
    console = MagicMock()
    return console

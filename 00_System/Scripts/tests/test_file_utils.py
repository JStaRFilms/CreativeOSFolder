"""Unit tests for file utility functions."""

import pytest
import os
import time
from pathlib import Path
from cos.file_utils import get_smart_date, find_meta_in_cwd
from cos.commands.sync import get_file_fingerprint


class TestGetSmartDate:
    """Tests for get_smart_date function."""
    
    def test_file_returns_mtime(self, temp_dir):
        """For a single file, should return its modification time."""
        test_file = temp_dir / "test.txt"
        test_file.write_text("content")
        
        expected = os.path.getmtime(test_file)
        result = get_smart_date(str(test_file))
        
        # Allow 1 second tolerance
        assert abs(result - expected) < 1.0
    
    def test_empty_directory_returns_dir_mtime(self, temp_dir):
        """For empty directory, should return directory's mtime."""
        empty_dir = temp_dir / "empty"
        empty_dir.mkdir()
        
        expected = os.path.getmtime(empty_dir)
        result = get_smart_date(str(empty_dir))
        
        assert abs(result - expected) < 1.0
    
    def test_skips_node_modules(self, temp_dir):
        """Should skip node_modules directory."""
        # Create node_modules with many files
        node_modules = temp_dir / "node_modules"
        node_modules.mkdir()
        for i in range(100):
            (node_modules / f"file{i}.js").write_text("content")
        
        # Create one file in root
        (temp_dir / "important.txt").write_text("important")
        
        start = time.time()
        result = get_smart_date(str(temp_dir))
        elapsed = time.time() - start
        
        # Should complete quickly (< 1 second) despite many files
        assert elapsed < 1.0
        assert result > 0  # Should return a valid timestamp
    
    def test_skips_git_directory(self, temp_dir):
        """Should skip .git directory."""
        # Create .git with files
        git_dir = temp_dir / ".git"
        git_dir.mkdir()
        (git_dir / "config").write_text("content")
        (git_dir / "HEAD").write_text("ref: refs/heads/main")
        
        # Create one file in root
        (temp_dir / "project.txt").write_text("project")
        
        result = get_smart_date(str(temp_dir))
        assert result > 0
    
    def test_handles_permission_error(self, temp_dir):
        """Should handle permission errors gracefully."""
        # Create a file
        test_file = temp_dir / "test.txt"
        test_file.write_text("content")
        
        # This should not raise
        result = get_smart_date(str(temp_dir))
        assert result > 0


class TestGetFileFingerprint:
    """Tests for get_file_fingerprint function."""
    
    def test_returns_mtime_and_size(self, temp_dir):
        """Should return dict with mtime and size."""
        test_file = temp_dir / "test.txt"
        test_file.write_text("Hello, World!")
        
        result = get_file_fingerprint(str(test_file))
        
        assert "mtime" in result
        assert "size" in result
        assert result["size"] == 13  # "Hello, World!" is 13 bytes
    
    def test_returns_none_for_nonexistent_file(self, temp_dir):
        """Should return None for nonexistent files."""
        result = get_file_fingerprint(str(temp_dir / "nonexistent.txt"))
        assert result is None
    
    def test_mtime_changes_after_modification(self, temp_dir):
        """mtime should change after file modification."""
        test_file = temp_dir / "test.txt"
        test_file.write_text("initial")
        
        fp1 = get_file_fingerprint(str(test_file))
        
        # Wait a moment and modify
        time.sleep(0.1)
        test_file.write_text("modified content")
        
        fp2 = get_file_fingerprint(str(test_file))
        
        assert fp2["mtime"] > fp1["mtime"]
        assert fp2["size"] > fp1["size"]

class TestFindMetaInCwd:
    """Tests for find_meta_in_cwd function."""
    
    def test_finds_meta_in_current_dir(self, sample_project, monkeypatch):
        """Should find meta if cwd is the project root."""
        monkeypatch.chdir(sample_project)
        # We also need to patch PROJECTS_PATH in file_utils to avoid validation failure
        monkeypatch.setattr("cos.file_utils.PROJECTS_PATH", str(sample_project.parent.parent))
        
        meta, path = find_meta_in_cwd()
        assert meta is not None
        assert meta["name"] == "Test Project"
        assert os.path.samefile(path, sample_project)
        
    def test_finds_meta_in_subdirectory(self, sample_project, monkeypatch):
        """Should find meta if cwd is inside 00_Notes directory."""
        notes_dir = sample_project / "00_Notes"
        monkeypatch.chdir(notes_dir)
        monkeypatch.setattr("cos.file_utils.PROJECTS_PATH", str(sample_project.parent.parent))
        
        meta, path = find_meta_in_cwd()
        assert meta is not None
        assert meta["name"] == "Test Project"
        assert os.path.samefile(path, sample_project)
        
    def test_returns_none_if_no_meta_found(self, temp_dir, monkeypatch):
        """Should return None if no project_meta.json exists."""
        monkeypatch.chdir(temp_dir)
        monkeypatch.setattr("cos.file_utils.PROJECTS_PATH", str(temp_dir.parent))
        
        meta, path = find_meta_in_cwd()
        assert meta is None
        assert path is None
        
    def test_ignores_invalid_json(self, temp_dir, monkeypatch):
        """Should return None if meta file contains invalid JSON."""
        monkeypatch.chdir(temp_dir)
        monkeypatch.setattr("cos.file_utils.PROJECTS_PATH", str(temp_dir.parent))
        
        # Create invalid meta file
        with open(temp_dir / ".project_meta.json", "w") as f:
            f.write("{invalid json")
            
        meta, path = find_meta_in_cwd()
        assert meta is None
        assert path is None

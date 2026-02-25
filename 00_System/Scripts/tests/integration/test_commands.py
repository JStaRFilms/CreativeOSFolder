"""
Integration tests for CreativeOS commands.

Tests the full workflow of commands without mocking.
"""

import pytest
import os
import json
from pathlib import Path
from unittest.mock import patch, MagicMock


class TestCmdNew:
    """Integration tests for the 'new' command."""
    
    @patch('cos.config.CONFIG')
    def test_creates_project_directory(self, mock_config, temp_projects_dir, sample_templates):
        """Should create project directory with correct structure."""
        from cos.commands.new import cmd_new
        
        # Setup mock config
        mock_config.__getitem__.side_effect = lambda key: {
            "projects_path": str(temp_projects_dir),
            "templates_path": str(sample_templates)
        }.get(key)
        
        # Create args
        args = MagicMock()
        args.name = "Test Project"
        args.category = "Video"
        args.simple = False
        args.date = None
        args.client = None
        args.git = False
        
        with patch('cos.commands.new.PROJECTS_PATH', str(temp_projects_dir)), \
             patch('cos.commands.new.TEMPLATES_PATH', str(sample_templates)):
            cmd_new(args)
        
        # Verify project was created
        video_path = temp_projects_dir / "Video"
        assert video_path.exists()
        
        # Find the created project
        projects = list(video_path.iterdir())
        assert len(projects) > 0
        
        project = projects[0]
        assert "Test_Project" in project.name
    
    @patch('cos.config.CONFIG')
    def test_creates_metadata_file(self, mock_config, temp_projects_dir, sample_templates):
        """Should create .project_meta.json with correct content."""
        from cos.commands.new import cmd_new
        
        mock_config.__getitem__.side_effect = lambda key: {
            "projects_path": str(temp_projects_dir),
            "templates_path": str(sample_templates)
        }.get(key)
        
        args = MagicMock()
        args.name = "Meta Test"
        args.category = "Code"
        args.simple = False
        args.date = "2026-01-15"
        args.client = None
        args.git = False
        
        with patch('cos.commands.new.PROJECTS_PATH', str(temp_projects_dir)), \
             patch('cos.commands.new.TEMPLATES_PATH', str(sample_templates)):
            cmd_new(args)
        
        # Find and check metadata
        code_path = temp_projects_dir / "Code"
        for project in code_path.iterdir():
            if "Meta_Test" in project.name:
                meta_path = project / ".project_meta.json"
                assert meta_path.exists()
                
                with open(meta_path) as f:
                    meta = json.load(f)
                
                assert meta["name"] == "Meta Test"
                assert meta["type"] == "Code"
                assert meta["created"] == "2026-01-15"
                break
    
    @patch('cos.config.CONFIG')
    def test_creates_notes_directory(self, mock_config, temp_projects_dir, sample_templates):
        """Should create 00_Notes directory with Idea.md."""
        from cos.commands.new import cmd_new
        
        mock_config.__getitem__.side_effect = lambda key: {
            "projects_path": str(temp_projects_dir),
            "templates_path": str(sample_templates)
        }.get(key)
        
        args = MagicMock()
        args.name = "Notes Test"
        args.category = "Video"
        args.simple = False
        args.date = None
        args.client = None
        args.git = False
        
        with patch('cos.commands.new.PROJECTS_PATH', str(temp_projects_dir)), \
             patch('cos.commands.new.TEMPLATES_PATH', str(sample_templates)):
            cmd_new(args)
        
        # Find project and check notes
        video_path = temp_projects_dir / "Video"
        for project in video_path.iterdir():
            if "Notes_Test" in project.name:
                notes_dir = project / "00_Notes"
                assert notes_dir.exists()
                
                idea_file = notes_dir / "Idea.md"
                assert idea_file.exists()
                
                content = idea_file.read_text()
                assert "Notes Test" in content
                break


class TestCmdInit:
    """Integration tests for the 'init' command."""
    
    @patch('cos.config.CONFIG')
    @patch('cos.commands.init.PROJECTS_PATH')
    def test_adopts_existing_directory(self, mock_projects_path, mock_config, temp_projects_dir):
        """Should add metadata to existing directory."""
        from cos.commands.init import cmd_init
        
        # Create an existing project directory
        existing_project = temp_projects_dir / "Video" / "Existing_Project"
        existing_project.mkdir(parents=True)
        (existing_project / "some_file.txt").write_text("content")
        
        mock_config.__getitem__.side_effect = lambda key: {
            "projects_path": str(temp_projects_dir)
        }.get(key)
        
        mock_projects_path.__str__.return_value = str(temp_projects_dir)
        # We can also just set the value of the mock variable directly for startswith checking
        mock_projects_path = str(temp_projects_dir)
        
        # Change to project directory
        original_cwd = os.getcwd()
        os.chdir(existing_project)
        
        try:
            with patch('cos.commands.init.PROJECTS_PATH', str(temp_projects_dir)):
                args = MagicMock()
                cmd_init(args)
            
            # Verify metadata was created
            meta_path = existing_project / ".project_meta.json"
            assert meta_path.exists()
            
            with open(meta_path) as f:
                meta = json.load(f)
            
            assert meta["name"] == "Existing_Project"
            assert "created" in meta
        finally:
            os.chdir(original_cwd)


class TestSyncTwoFolders:
    """Integration tests for bidirectional sync."""
    
    def test_pushes_new_file_to_vault(self, temp_dir):
        """Should copy new file from project to vault."""
        from cos.commands.sync import sync_two_folders
        
        # Create project notes
        project_notes = temp_dir / "project" / "00_Notes"
        project_notes.mkdir(parents=True)
        (project_notes / "Idea.md").write_text("# My Idea\n\nThis is my idea.")
        
        # Create vault notes
        vault_notes = temp_dir / "vault" / "project"
        vault_notes.mkdir(parents=True)
        
        logs, state = sync_two_folders(str(project_notes), str(vault_notes))
        
        # Verify file was pushed
        assert len(logs) == 1
        assert logs[0]["type"] == "push"
        
        # Verify file exists in vault
        assert (vault_notes / "Idea.md").exists()
        assert (vault_notes / "Idea.md").read_text() == "# My Idea\n\nThis is my idea."
    
    def test_pulls_new_file_from_vault(self, temp_dir):
        """Should copy new file from vault to project."""
        from cos.commands.sync import sync_two_folders
        
        # Create project notes (empty)
        project_notes = temp_dir / "project" / "00_Notes"
        project_notes.mkdir(parents=True)
        
        # Create vault notes with file
        vault_notes = temp_dir / "vault" / "project"
        vault_notes.mkdir(parents=True)
        (vault_notes / "Script.md").write_text("# Script\n\nContent.")
        
        logs, state = sync_two_folders(str(project_notes), str(vault_notes))
        
        # Verify file was pulled
        assert len(logs) == 1
        assert logs[0]["type"] == "pull"
        
        # Verify file exists in project
        assert (project_notes / "Script.md").exists()
    
    def test_no_changes_when_identical(self, temp_dir):
        """Should not make changes when files are identical."""
        from cos.commands.sync import sync_two_folders
        
        # Create identical files
        project_notes = temp_dir / "project" / "00_Notes"
        project_notes.mkdir(parents=True)
        (project_notes / "Idea.md").write_text("Same content")
        
        vault_notes = temp_dir / "vault" / "project"
        vault_notes.mkdir(parents=True)
        (vault_notes / "Idea.md").write_text("Same content")
        
        logs, state = sync_two_folders(str(project_notes), str(vault_notes))
        
        # Should be no changes
        assert len(logs) == 0

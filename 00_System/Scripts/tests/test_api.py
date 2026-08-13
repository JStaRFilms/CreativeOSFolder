import json
from pathlib import Path
import pytest
from starlette.testclient import TestClient
from cos.api import app


@pytest.fixture
def client():
    return TestClient(app)


def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "projects_path" in data


def test_categories_endpoint(client):
    response = client.get("/api/categories")
    assert response.status_code == 200
    data = response.json()
    assert "categories" in data
    assert "enabled" in data
    assert "default_category" in data
    assert "Video" in data["categories"]


def test_config_endpoint(client):
    response = client.get("/api/config")
    assert response.status_code == 200
    data = response.json()
    assert "config" in data
    assert "paths" in data
    assert "version" in data


def test_projects_endpoint(client):
    response = client.get("/api/projects")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    for proj in data:
        assert "name" in proj
        assert "icon" in proj
        assert "status" in proj


def test_storage_endpoint(client):
    response = client.get("/api/storage")
    assert response.status_code == 200
    data = response.json()
    assert "project_count" in data
    assert "total_size" in data
    assert "projects" in data


def test_create_project_and_validation(client, temp_projects_dir, monkeypatch):
    monkeypatch.setattr("cos.commands.new.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.config.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.api.PROJECTS_PATH", str(temp_projects_dir))

    # Test invalid project name with invalid chars
    invalid_resp = client.post("/api/projects", json={
        "name": "Invalid/Project/Name",
        "category": "Video",
    })
    assert invalid_resp.status_code == 400

    # Test valid project creation
    valid_resp = client.post("/api/projects", json={
        "name": "GUI Test Project",
        "category": "Video",
        "client": "TestClient",
        "simple": True,
    })
    assert valid_resp.status_code == 201
    created_data = valid_resp.json()
    assert created_data["status"] == "success"
    assert created_data["project"]["name"] == "GUI Test Project"
    assert created_data["project"]["client"] == "TestClient"

    # Test duplicate creation returns 409
    dup_resp = client.post("/api/projects", json={
        "name": "GUI Test Project",
        "category": "Video",
        "client": "TestClient",
        "simple": True,
    })
    assert dup_resp.status_code == 409


def test_storage_refresh_endpoint(client, temp_projects_dir, temp_dir, monkeypatch):
    test_index = temp_dir / "storage_index.json"
    monkeypatch.setattr("cos.storage.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.config.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.api.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.storage.STORAGE_INDEX_PATH", str(test_index))

    response = client.post("/api/storage/refresh")
    assert response.status_code == 200
    data = response.json()
    assert "project_count" in data
    assert "total_size" in data



def test_sync_endpoint(client, temp_projects_dir, temp_dir, monkeypatch):
    vault_dir = temp_dir / "vault"
    vault_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr("cos.commands.sync.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.commands.sync.VAULT_PATH", str(vault_dir))
    monkeypatch.setattr("cos.config.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.config.VAULT_PATH", str(vault_dir))

    response = client.post("/api/sync")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "projects_synced" in data
    assert "total_changes" in data


def test_spa_root_serving(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "CreativeOS" in response.text


def test_fs_list_endpoint_and_security_boundary(client, temp_projects_dir, monkeypatch):
    monkeypatch.setattr("cos.api.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.config.PROJECTS_PATH", str(temp_projects_dir))

    # Create dummy folder & files
    sample_dir = temp_projects_dir / "Video" / "2026-01-01_Test_Project"
    sample_dir.mkdir(parents=True, exist_ok=True)
    (sample_dir / "notes.md").write_text("# Notes", encoding="utf-8")
    (sample_dir / "subfolder").mkdir(exist_ok=True)

    # 1. Test valid listing
    resp = client.get(f"/api/fs/list?path={sample_dir}")
    assert resp.status_code == 200
    data = resp.json()
    assert "entries" in data
    assert len(data["entries"]) >= 2
    # Folders first
    assert data["entries"][0]["is_dir"] is True
    assert data["entries"][0]["name"] == "subfolder"

    # 2. Test path traversal security boundary rejection
    outside_resp = client.get("/api/fs/list?path=C:/Windows/System32")
    assert outside_resp.status_code == 403


def test_fs_open_endpoint(client, temp_projects_dir, monkeypatch):
    monkeypatch.setattr("cos.api.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.config.PROJECTS_PATH", str(temp_projects_dir))

    sample_file = temp_projects_dir / "test.txt"
    sample_file.write_text("hello", encoding="utf-8")

    # Mock os.startfile / subprocess
    monkeypatch.setattr("os.startfile", lambda p: None, raising=False)

    resp = client.post("/api/fs/open", json={"path": str(sample_file)})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"

    # Test outside path rejection
    resp_outside = client.post("/api/fs/open", json={"path": "C:/Windows/System32/cmd.exe"})
    assert resp_outside.status_code == 403


def test_update_project_metadata(client, temp_projects_dir, monkeypatch):
    monkeypatch.setattr("cos.commands.new.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.config.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.api.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.storage.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.api.refresh_storage_index", lambda *args, **kwargs: {}, raising=False)

    # Create project first
    client.post("/api/projects", json={
        "name": "Meta Test Project",
        "category": "Video",
        "client": "Alpha",
        "simple": True,
    })

    # 1. Update metadata only (sync_filesystem=False)
    update_resp = client.put("/api/projects/Meta Test Project", json={
        "name": "Updated Meta Project",
        "client": "Beta Corp",
        "description": "A new summary",
        "tags": ["film", "edit"],
        "sync_filesystem": False,
    })
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["status"] == "success"
    assert data["moved"] is False
    assert data["project"]["name"] == "Updated Meta Project"
    assert data["project"]["client"] == "Beta Corp"
    assert data["project"]["description"] == "A new summary"
    assert "film" in data["project"]["tags"]

    # 2. Update with physical folder move (sync_filesystem=True)
    move_resp = client.put("/api/projects/Updated Meta Project", json={
        "name": "Renamed Physical Project",
        "client": "Omega Client",
        "sync_filesystem": True,
    })
    assert move_resp.status_code == 200
    move_data = move_resp.json()
    assert move_data["status"] == "success"
    assert move_data["moved"] is True
    assert "Omega Client" in move_data["new_path"]
    assert "Renamed_Physical_Project" in move_data["new_path"]
    assert Path(move_data["new_path"]).exists()



def test_archive_and_resurrect_endpoints(client, temp_projects_dir, temp_dir, monkeypatch):
    archive_dir = temp_dir / "Archive"
    archive_dir.mkdir(parents=True, exist_ok=True)
    shuttle_dir = temp_dir / "Shuttle"
    shuttle_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr("cos.commands.new.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.config.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.api.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.storage.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.api.refresh_storage_index", lambda *args, **kwargs: {}, raising=False)
    monkeypatch.setattr("cos.config.ARCHIVE_PATH", str(archive_dir))
    monkeypatch.setattr("cos.api.ARCHIVE_PATH", str(archive_dir))
    monkeypatch.setattr("cos.config.SHUTTLE_PATH", str(shuttle_dir))
    monkeypatch.setattr("cos.api.SHUTTLE_PATH", str(shuttle_dir))

    # 1. Create a project
    client.post("/api/projects", json={
        "name": "Travel Project",
        "category": "Video",
        "simple": True,
    })

    # 2. Travel to Shuttle
    travel_resp = client.post("/api/projects/Travel Project/travel")
    assert travel_resp.status_code == 200
    assert travel_resp.json()["status"] == "success"

    # 3. Archive Project
    archive_resp = client.post("/api/projects/Travel Project/archive")
    assert archive_resp.status_code == 200
    assert archive_resp.json()["status"] == "success"

    # 4. List Archived Projects
    list_arch_resp = client.get("/api/projects/archived")
    assert list_arch_resp.status_code == 200
    archived_list = list_arch_resp.json()
    assert len(archived_list) >= 1
    assert any(p["name"] == "Travel Project" for p in archived_list)

    # 5. Resurrect Project
    resurrect_resp = client.post("/api/projects/Travel Project/resurrect")
    assert resurrect_resp.status_code == 200
    assert resurrect_resp.json()["status"] == "success"


def test_sync_stream_endpoint(client, temp_projects_dir, temp_dir, monkeypatch):
    vault_dir = temp_dir / "vault"
    vault_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr("cos.commands.sync.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.commands.sync.VAULT_PATH", str(vault_dir))
    monkeypatch.setattr("cos.config.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.config.VAULT_PATH", str(vault_dir))

    resp = client.get("/api/sync/stream")
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers.get("content-type", "")
    content = resp.text
    assert "data:" in content


def test_create_project_in_subfolder(client, temp_projects_dir, monkeypatch):
    monkeypatch.setattr("cos.commands.new.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.config.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.api.PROJECTS_PATH", str(temp_projects_dir))
    monkeypatch.setattr("cos.storage.PROJECTS_PATH", str(temp_projects_dir))

    resp = client.post("/api/projects", json={
        "name": "Nested Subproject",
        "category": "Video",
        "destination_subpath": "Clients/MegaClient/Campaign_2026/Subprojects",
        "simple": True,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "success"
    project_path = Path(data["project"]["path"])
    assert "Clients" in project_path.parts
    assert "MegaClient" in project_path.parts
    assert "Campaign_2026" in project_path.parts
    assert "Subprojects" in project_path.parts
    assert project_path.exists()
    assert (project_path / ".project_meta.json").exists()


def test_update_config_paths_endpoint(client, temp_dir, monkeypatch):
    test_config_path = temp_dir / "test_config.json"
    dummy_config = {
        "root_path": str(temp_dir),
        "projects_path": str(temp_dir / "Projects"),
        "vault_path": str(temp_dir / "Vault"),
        "exports_path": str(temp_dir / "Exports"),
        "version": "1.3"
    }
    with open(test_config_path, "w", encoding="utf-8") as f:
        json.dump(dummy_config, f, indent=4)

    monkeypatch.setattr("cos.api.CONFIG_PATH", str(test_config_path))
    monkeypatch.setattr("cos.config.CONFIG_PATH", str(test_config_path))

    new_vault = temp_dir / "NewVault"
    resp = client.put("/api/config/paths", json={
        "paths": {
            "vault_path": str(new_vault)
        },
        "move_files": False
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["config"]["vault_path"] == str(new_vault)



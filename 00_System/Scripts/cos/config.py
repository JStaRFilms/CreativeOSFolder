"""Configuration loading and management."""

import os
import json
import sys
import stat
import logging
from typing import Dict, Any, Union

from .console import console

# Type aliases
JSONDict = Dict[str, Any]
FileFingerprint = Dict[str, Union[float, int]]
SyncState = Dict[str, Any]

# File permissions
CONFIG_PERMISSIONS = stat.S_IRUSR | stat.S_IWUSR  # 0o600 - owner read/write only
DIR_PERMISSIONS = stat.S_IRWXU | stat.S_IRWXG | stat.S_IROTH | stat.S_IXOTH  # 0o750

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Two levels up because we're in Scripts/cos now
CONFIG_PATH = os.path.join(SCRIPT_DIR, "..", "..", "Config", "config.json")

if not os.path.exists(CONFIG_PATH):
    console.print("❌ [error]CRITICAL ERROR: Config file not found.[/error]")
    sys.exit(1)

with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    CONFIG = json.load(f)

ROOT_PATH = CONFIG["root_path"]
PROJECTS_PATH = CONFIG["projects_path"]
EXPORTS_PATH = CONFIG["exports_path"]
TEMPLATES_PATH = CONFIG["templates_path"]
VAULT_PATH = CONFIG["vault_path"]
DOWNLOADS_PATH = CONFIG.get("downloads_path", os.path.join(os.path.expanduser("~"), "Downloads"))
SHUTTLE_PATH = CONFIG.get("shuttle_path", "A:\\CreativeOS_Shuttle")
ARCHIVE_PATH = CONFIG.get("archive_path", "D:\\OneDrive - Developer\\Archive")

# --- SYNC OPTIMIZATION CONSTANTS ---
# Directories to skip during traversal for massive speedup
EXCLUDED_DIRS = {
    'node_modules', '.git', '__pycache__', '.venv', 'venv', 'env',
    '.idea', '.vscode', 'dist', 'build', '.next', '.nuxt', 'coverage',
    '.pytest_cache', '.mypy_cache', 'egg-info', 'EGG-INFO', 'target',
    'vendor', 'Pods', '.gradle', 'DerivedData', '.cache'
}

# Sync state database path for incremental syncs
SYNC_STATE_PATH = os.path.join(SCRIPT_DIR, "..", "..", "Config", "sync_state.json")
PROJECT_INDEX_PATH = os.path.join(SCRIPT_DIR, "..", "..", "Config", "project_index.json")

# --- LOGGING SETUP ---
LOG_PATH = os.path.join(SCRIPT_DIR, "..", "..", "Config", "creativeos.log")

# Create logger
logger = logging.getLogger('creativeos')
logger.setLevel(logging.DEBUG)

# Create file handler
file_handler = logging.FileHandler(LOG_PATH, encoding='utf-8')
file_handler.setLevel(logging.DEBUG)

# Create formatter
formatter = logging.Formatter(
    '%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
file_handler.setFormatter(formatter)

# Add handler to logger
logger.addHandler(file_handler)

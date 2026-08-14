"""Category configuration loading and management.

This module provides dynamic category loading from categories.json,
allowing users to add/edit/remove categories without modifying code.
"""

import os
import json
import logging
from typing import Dict, List, Optional, Any
from pathlib import Path

from .console import console

# Type aliases
CategoryConfig = Dict[str, Any]
CategoriesDict = Dict[str, CategoryConfig]

# Setup logger
logger = logging.getLogger('creativeos')

# Determine paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_DIR = os.path.join(SCRIPT_DIR, "..", "..", "Config")
CATEGORIES_PATH = os.path.join(CONFIG_DIR, "categories.json")

# Default categories for fallback
DEFAULT_CATEGORIES: CategoriesDict = {
    "Video": {
        "template": "video_project",
        "physical_folder": "Video",
        "aliases": [],
        "description": "Video production projects",
        "icon": "🎬",
        "enabled": True,
        "folder_structure": ["00_Notes", "01_Footage", "02_Audio", "03_Exports", "04_Assets", "99_Archive"]
    },
    "Code": {
        "template": "plain_code",
        "physical_folder": "Code",
        "aliases": ["Web", "Dev"],
        "description": "Software development projects",
        "icon": "💻",
        "enabled": True,
        "folder_structure": ["00_Notes", "01_Source", "02_Build", "03_Docs"]
    },
    "Audio": {
        "template": "audio_project",
        "physical_folder": "Music",
        "aliases": ["Music"],
        "description": "Audio and music production",
        "icon": "🎵",
        "enabled": True,
        "folder_structure": ["00_Notes", "01_Project", "02_Stems", "03_Exports", "04_Samples"]
    },
    "AI": {
        "template": "ai_project",
        "physical_folder": "AI",
        "aliases": ["ML", "MachineLearning"],
        "description": "AI and machine learning projects",
        "icon": "🤖",
        "enabled": True,
        "folder_structure": ["00_Notes", "01_Data", "02_Models", "03_Notebooks", "04_Exports"]
    },
    "Design": {
        "template": "design_project",
        "physical_folder": "Design",
        "aliases": ["Graphics"],
        "description": "Graphic design projects",
        "icon": "🎨",
        "enabled": True,
        "folder_structure": ["00_Notes", "01_Assets", "02_Working", "03_Exports", "04_Pres"]
    },
    "Photo": {
        "template": "photo_project",
        "physical_folder": "Photo",
        "aliases": ["Photography"],
        "description": "Photography projects",
        "icon": "📷",
        "enabled": True,
        "folder_structure": ["00_Notes", "01_RAW", "02_Selects", "03_Edits", "04_Exports"]
    },
    "Writing": {
        "template": "writing_project",
        "physical_folder": "Writing",
        "aliases": ["Blog", "Article"],
        "description": "Writing and blogging projects",
        "icon": "✍️",
        "enabled": True,
        "folder_structure": ["00_Notes", "01_Drafts", "02_Edits", "03_Final", "05_Refs"]
    },
    "Podcast": {
        "template": "podcast_project",
        "physical_folder": "Music",
        "aliases": [],
        "description": "Podcast production",
        "icon": "🎙️",
        "enabled": True,
        "folder_structure": ["00_Notes", "01_Recordings", "02_Editing", "03_Assets"]
    },
    "Course": {
        "template": "course_project",
        "physical_folder": "Course",
        "aliases": ["Tutorial", "Education"],
        "description": "Online course creation",
        "icon": "📚",
        "enabled": True,
        "folder_structure": ["00_Notes", "01_Scripts", "02_Footage", "03_Assets", "04_Exports"]
    }
}


def load_categories() -> Dict[str, Any]:
    """Load categories configuration from JSON file.
    
    Returns:
        Dictionary containing full categories configuration.
        Falls back to defaults if file is missing or corrupt.
    """
    if not os.path.exists(CATEGORIES_PATH):
        logger.warning(f"categories.json not found at {CATEGORIES_PATH}, using defaults")
        return {
            "version": "1.0",
            "default_category": "Video",
            "simple_template": "simple",
            "categories": DEFAULT_CATEGORIES
        }
    
    try:
        with open(CATEGORIES_PATH, "r", encoding="utf-8") as f:
            config = json.load(f)
        
        # Validate structure
        if "categories" not in config:
            logger.warning("categories.json missing 'categories' key, using defaults")
            config["categories"] = DEFAULT_CATEGORIES
        
        logger.debug(f"Loaded {len(config.get('categories', {}))} categories from config")
        return config
    
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in categories.json: {e}")
        console.print(f"[warning]⚠️  categories.json is corrupt, using defaults[/warning]")
        return {
            "version": "1.0",
            "default_category": "Video",
            "simple_template": "simple",
            "categories": DEFAULT_CATEGORIES
        }


def save_categories(config: Dict[str, Any]) -> bool:
    """Save categories configuration to JSON file.
    
    Args:
        config: Full categories configuration dictionary.
        
    Returns:
        True if saved successfully, False otherwise.
    """
    try:
        # Ensure config directory exists
        os.makedirs(os.path.dirname(CATEGORIES_PATH), exist_ok=True)
        
        with open(CATEGORIES_PATH, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        logger.debug("Saved categories configuration")
        return True
    
    except (IOError, OSError) as e:
        logger.error(f"Failed to save categories.json: {e}")
        console.print(f"[error]❌ Failed to save categories: {e}[/error]")
        return False


def get_categories() -> CategoriesDict:
    """Get all categories.
    
    Returns:
        Dictionary of category name to category config.
    """
    config = load_categories()
    return config.get("categories", DEFAULT_CATEGORIES)


def get_enabled_categories() -> CategoriesDict:
    """Get only enabled categories.
    
    Returns:
        Dictionary of enabled category name to category config.
    """
    categories = get_categories()
    return {k: v for k, v in categories.items() if v.get("enabled", True)}


def get_category(name: str) -> Optional[CategoryConfig]:
    """Get a specific category by name or alias.
    
    Args:
        name: Category name or alias.
        
    Returns:
        Category configuration or None if not found.
    """
    categories = get_categories()
    
    # Direct match
    if name in categories:
        return categories[name]
    
    # Check aliases (case-insensitive)
    name_lower = name.lower()
    for cat_name, cat_config in categories.items():
        aliases = [a.lower() for a in cat_config.get("aliases", [])]
        if name_lower in aliases or name_lower == cat_name.lower():
            return cat_config
    
    return None


def get_default_category() -> str:
    """Get the default category name.
    
    Returns:
        Default category name.
    """
    config = load_categories()
    return config.get("default_category", "Video")


def get_simple_template() -> str:
    """Get the simple template name.
    
    Returns:
        Simple template name.
    """
    config = load_categories()
    return config.get("simple_template", "simple")


def get_category_template(category: str) -> str:
    """Get the template for a category.
    
    Args:
        category: Category name or alias.
        
    Returns:
        Template name for the category.
    """
    cat_config = get_category(category)
    if cat_config:
        return cat_config.get("template", f"{category.lower()}_project")
    return "simple"


def get_category_folder(category: str) -> str:
    """Get the physical folder for a category.
    
    Args:
        category: Category name or alias.
        
    Returns:
        Physical folder name for the category.
    """
    cat_config = get_category(category)
    if cat_config:
        return cat_config.get("physical_folder", category)
    return category


def get_category_icon(category: str) -> str:
    """Get the icon for a category.
    
    Args:
        category: Category name or alias.
        
    Returns:
        Icon emoji for the category.
    """
    cat_config = get_category(category)
    if cat_config:
        return cat_config.get("icon", "📁")
    return "📁"


def get_category_names() -> List[str]:
    """Get list of all category names.
    
    Returns:
        List of category names.
    """
    return list(get_categories().keys())


def get_enabled_category_names() -> List[str]:
    """Get list of enabled category names.
    
    Returns:
        List of enabled category names.
    """
    return list(get_enabled_categories().keys())


def resolve_category_name(name: str) -> str:
    """Resolve a category name or alias to the canonical name.
    
    Args:
        name: Category name or alias.
        
    Returns:
        Canonical category name, or original if not found.
    """
    categories = get_categories()
    
    # Direct match
    if name in categories:
        return name
    
    # Check aliases (case-insensitive)
    name_lower = name.lower()
    for cat_name, cat_config in categories.items():
        if cat_name.lower() == name_lower:
            return cat_name
        aliases = [a.lower() for a in cat_config.get("aliases", [])]
        if name_lower in aliases:
            return cat_name
    
    # Return original if not found
    return name


def category_exists(name: str) -> bool:
    """Check if a category exists (by name or alias).
    
    Args:
        name: Category name or alias.
        
    Returns:
        True if category exists, False otherwise.
    """
    return get_category(name) is not None


def get_categories_path() -> str:
    """Get the path to categories.json.
    
    Returns:
        Path to categories.json file.
    """
    return CATEGORIES_PATH

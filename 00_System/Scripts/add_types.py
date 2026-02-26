import os

filepath = r'c:\CreativeOS\00_System\Scripts\manage.py'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    (
        'from urllib.parse import urlparse\n',
        'from urllib.parse import urlparse\nfrom typing import Optional, Dict, List, Tuple, Any, Union\nfrom pathlib import Path\n\n# Type aliases\nJSONDict = Dict[str, Any]\nFileFingerprint = Dict[str, Union[float, int]]\nSyncState = Dict[str, Any]\n'
    ),
    (
        'def get_date_slug(override_date: str = None) -> str:',
        'def get_date_slug(override_date: Optional[str] = None) -> str:'
    ),
    (
        'def format_path(path):',
        'def format_path(path: str) -> str:'
    ),
    (
        '        abs_path = os.path.abspath(path)\n        url = urllib.request.pathname2url(abs_path)',
        '        abs_path: str = os.path.abspath(path)\n        url: str = urllib.request.pathname2url(abs_path)'
    ),
    (
        '    except:\n        return f"[path]{path}[/path]"',
        '    except Exception:\n        return f"[path]{path}[/path]"'
    ),
    (
        'def get_export_month_path():',
        'def get_export_month_path() -> str:'
    ),
    (
        '    year = now.strftime("%Y")\n    month_name = now.strftime("%B")\n    month_num = now.strftime("%m")\n    \n    full_path = os.path.join(EXPORTS_PATH, year, f"{month_num} - {month_name}")',
        '    year: str = now.strftime("%Y")\n    month_name: str = now.strftime("%B")\n    month_num: str = now.strftime("%m")\n    \n    full_path: str = os.path.join(EXPORTS_PATH, year, f"{month_num} - {month_name}")'
    ),
    (
        'def find_meta_in_cwd():',
        'def find_meta_in_cwd() -> Tuple[Optional[JSONDict], Optional[str]]:'
    ),
    (
        'def load_sync_state():',
        'def load_sync_state() -> SyncState:'
    ),
    (
        'def save_sync_state(state):',
        'def save_sync_state(state: SyncState) -> None:'
    ),
    (
        'def get_file_fingerprint(filepath):',
        'def get_file_fingerprint(filepath: str) -> Optional[FileFingerprint]:'
    ),
    (
        'def get_syncable_files(root_dir):',
        'def get_syncable_files(root_dir: str) -> Dict[str, Optional[FileFingerprint]]:'
    ),
    (
        'def sync_two_folders(dir_a, dir_b, prev_state=None):',
        'def sync_two_folders(dir_a: str, dir_b: str, prev_state: Optional[SyncState] = None) -> Tuple[List[Dict[str, str]], SyncState]:'
    ),
    (
        'def copy_with_progress(src, dst):',
        'def copy_with_progress(src: str, dst: str) -> None:'
    ),
    (
        'def setup_git(project_path, category):',
        'def setup_git(project_path: str, category: str) -> None:'
    ),
    (
        'def cmd_new(args):',
        'def cmd_new(args: argparse.Namespace) -> None:'
    ),
    (
        'def cmd_init(args):',
        'def cmd_init(args: argparse.Namespace) -> None:'
    ),
    (
        'def cmd_export(args):',
        'def cmd_export(args: argparse.Namespace) -> None:'
    ),
    (
        'def cmd_sync(args):',
        'def cmd_sync(args: argparse.Namespace) -> None:'
    ),
    (
        'def cmd_thumbs(args):',
        'def cmd_thumbs(args: argparse.Namespace) -> None:'
    ),
    (
        'def cmd_clone(args):',
        'def cmd_clone(args: argparse.Namespace) -> None:'
    ),
    (
        'def cmd_clean(args):',
        'def cmd_clean(args: argparse.Namespace) -> None:'
    ),
    (
        'def cmd_sort_exports(args):',
        'def cmd_sort_exports(args: argparse.Namespace) -> None:'
    ),
    (
        'def cmd_travel(args):',
        'def cmd_travel(args: argparse.Namespace) -> None:'
    ),
    (
        'def remove_readonly(func, path, excinfo):',
        'def remove_readonly(func: Any, path: str, excinfo: Any) -> None:'
    ),
    (
        'def robust_rmtree(path, retries=5, delay=1):',
        'def robust_rmtree(path: str, retries: int = 5, delay: int = 1) -> bool:'
    ),
    (
        'def cmd_resurrect(args):',
        'def cmd_resurrect(args: argparse.Namespace) -> None:'
    ),
    (
        'def main():',
        'def main() -> None:'
    )
]

for old_str, new_str in replacements:
    if old_str in content:
        content = content.replace(old_str, new_str)
        print(f"Replaced {old_str.strip()[:30]}")
    else:
        print(f"NOT FOUND: {old_str.strip()[:30]}")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')

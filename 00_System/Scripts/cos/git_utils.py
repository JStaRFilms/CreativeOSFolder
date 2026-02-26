"""Git operations."""

import os
import shutil
import subprocess
from rich.prompt import Confirm
from .console import console
from .config import TEMPLATES_PATH

def setup_git(project_path: str, category: str) -> None:
    """
    Initialize a Git repository and add a .gitignore file.
    """
    console.print("   [info]🔧 Initializing Git Repository...[/info]")
    
    # 1. Run git init
    try:
        subprocess.run(["git", "init"], cwd=project_path, check=True, stdout=subprocess.DEVNULL)
    except FileNotFoundError:
        console.print("   [warning]⚠️  Git is not installed or not in PATH. Skipping.[/warning]")
        return
    except Exception as e:
        console.print(f"   [error]❌ Git init failed: {e}[/error]")
        return

    # 2. Copy .gitignore
    gitignore_src = os.path.join(TEMPLATES_PATH, "universal.gitignore")
    gitignore_dest = os.path.join(project_path, ".gitignore")
    
    if os.path.exists(gitignore_src):
        shutil.copy2(gitignore_src, gitignore_dest)
    else:
        with open(gitignore_dest, "w") as f:
            f.write("# CreativeOS Auto-Gitignore\nnode_modules/\n__pycache__/\n.env\n")

    console.print("   [success]✅ Git initialized & .gitignore added.[/success]")

    # 3. Initial Commit Prompt
    console.print("")
    console.print("   [info]📦 An initial commit will stage all project files and commit them with the message:[/info]")
    console.print("      [dim]\"Initial commit via CreativeOS Genesis\"[/dim]")
    console.print("")
    
    if Confirm.ask("   Make initial commit now?", default=True):
        try:
            with console.status("[bold cyan]   Staging and committing...[/bold cyan]"):
                subprocess.run(["git", "add", "."], cwd=project_path, check=True, stdout=subprocess.DEVNULL)
                subprocess.run(["git", "commit", "-m", "Initial commit via CreativeOS Genesis"], cwd=project_path, check=True, stdout=subprocess.DEVNULL)
            console.print("   [success]✅ Initial commit complete.[/success]")
        except Exception as e:
            console.print(f"   [error]❌ Initial commit failed: {e}[/error]")
    else:
        console.print("   [dim]Skipped initial commit. You can commit manually later.[/dim]")

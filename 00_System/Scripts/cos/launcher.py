"""Self-contained desktop app launcher and lifecycle manager for CreativeOS."""

from __future__ import annotations

import os
import sys
import time
import socket
import shutil
import urllib.request
import urllib.error
import subprocess
from pathlib import Path
from typing import Optional, Tuple

# Ensure 00_System/Scripts is in sys.path so cos package can be imported anywhere
_scripts_dir = str(Path(__file__).parent.parent.resolve())
if _scripts_dir not in sys.path:
    sys.path.insert(0, _scripts_dir)

from cos.config import ROOT_PATH, SCRIPT_DIR, logger
from cos.console import console


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8787


def is_server_running(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT, timeout: float = 0.4) -> bool:
    """Check if the CreativeOS API server is running and healthy on the given host and port."""
    url = f"http://{host}:{port}/api/health"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CreativeOS-Launcher"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status == 200
    except (urllib.error.URLError, socket.timeout, ConnectionRefusedError, OSError):
        return False


def find_python_executable(gui: bool = True) -> str:
    """Locate the Python executable, preferring pythonw.exe on Windows for headless execution."""
    if gui and sys.platform == "win32":
        # Check adjacent to current sys.executable
        candidate = Path(sys.executable).parent / "pythonw.exe"
        if candidate.is_file():
            return str(candidate)
        
        # Check PATH for pythonw
        which_pythonw = shutil.which("pythonw")
        if which_pythonw:
            return which_pythonw

    return sys.executable


def find_app_browser() -> Tuple[Optional[str], str]:
    """Find a Chromium-based browser supporting standalone --app mode on Windows/macOS/Linux."""
    if sys.platform == "win32":
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        program_files = os.environ.get("ProgramFiles", "C:\\Program Files")
        program_files_x86 = os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)")

        candidates = [
            # Edge (built-in on Windows 10/11)
            (os.path.join(program_files_x86, "Microsoft", "Edge", "Application", "msedge.exe"), "Microsoft Edge"),
            (os.path.join(program_files, "Microsoft", "Edge", "Application", "msedge.exe"), "Microsoft Edge"),
            (os.path.join(local_app_data, "Microsoft", "Edge", "Application", "msedge.exe"), "Microsoft Edge"),
            # Google Chrome
            (os.path.join(program_files, "Google", "Chrome", "Application", "chrome.exe"), "Google Chrome"),
            (os.path.join(program_files_x86, "Google", "Chrome", "Application", "chrome.exe"), "Google Chrome"),
            (os.path.join(local_app_data, "Google", "Chrome", "Application", "chrome.exe"), "Google Chrome"),
            # Brave
            (os.path.join(program_files, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"), "Brave Browser"),
            (os.path.join(local_app_data, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"), "Brave Browser"),
        ]

        for path, name in candidates:
            if path and os.path.isfile(path):
                return path, name

        # Check PATH for edge or chrome
        for cmd, name in [("msedge", "Microsoft Edge"), ("chrome", "Google Chrome"), ("brave", "Brave")]:
            which_path = shutil.which(cmd)
            if which_path:
                return which_path, name

    elif sys.platform == "darwin":
        mac_candidates = [
            ("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "Google Chrome"),
            ("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "Microsoft Edge"),
            ("/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", "Brave Browser"),
        ]
        for path, name in mac_candidates:
            if os.path.isfile(path):
                return path, name

    else:
        # Linux
        for cmd, name in [("google-chrome", "Google Chrome"), ("chromium-browser", "Chromium"), ("chromium", "Chromium"), ("microsoft-edge", "Microsoft Edge")]:
            which_path = shutil.which(cmd)
            if which_path:
                return which_path, name

    return None, "Default Browser"


def get_browser_profile_dir() -> str:
    """Return an isolated user data directory for the standalone CreativeOS app window."""
    if sys.platform == "win32":
        base = os.environ.get("LOCALAPPDATA", os.path.expanduser("~"))
        profile_dir = os.path.join(base, "CreativeOS", "BrowserProfile")
    else:
        profile_dir = os.path.expanduser("~/.creativeos/browser_profile")
    
    os.makedirs(profile_dir, exist_ok=True)
    return profile_dir


def start_background_server(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT, reload: bool = False) -> subprocess.Popen:
    """Launch the FastAPI server as a detached, silent background process with managed lifecycle."""
    python_exe = find_python_executable(gui=True)
    scripts_dir = str(Path(SCRIPT_DIR).resolve())
    
    env = os.environ.copy()
    existing_pythonpath = env.get("PYTHONPATH", "")
    if scripts_dir not in existing_pythonpath:
        env["PYTHONPATH"] = f"{scripts_dir}{os.pathsep}{existing_pythonpath}" if existing_pythonpath else scripts_dir

    # Flag this server as managed so its heartbeat watchdog will auto-terminate it when all GUI windows close
    env["CREATIVEOS_MANAGED"] = "1"

    cmd = [
        python_exe,
        "-m",
        "uvicorn",
        "cos.api:app",
        "--host",
        host,
        "--port",
        str(port),
    ]
    if reload:
        cmd.append("--reload")

    creationflags = 0
    if sys.platform == "win32":
        # CREATE_NO_WINDOW = 0x08000000 | DETACHED_PROCESS = 0x00000008
        creationflags = 0x08000000 | 0x00000008

    logger.info(f"Spawning background CreativeOS server on {host}:{port} with {python_exe}")
    proc = subprocess.Popen(
        cmd,
        cwd=scripts_dir,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
        creationflags=creationflags,
    )

    # Wait for the server to become healthy (up to 6 seconds)
    start_time = time.time()
    while time.time() - start_time < 6.0:
        if is_server_running(host, port, timeout=0.2):
            logger.info(f"Background server ready in {time.time() - start_time:.2f}s")
            return proc
        if proc.poll() is not None:
            raise RuntimeError(f"CreativeOS server exited prematurely with return code {proc.returncode}")
        time.sleep(0.1)

    raise TimeoutError(f"CreativeOS server on {host}:{port} did not respond within 6 seconds.")


def launch_app_window(url: str) -> Tuple[Optional[subprocess.Popen], str]:
    """Launch the standalone app window in frameless Chromium app mode, or open default browser."""
    browser_exe, browser_name = find_app_browser()

    if browser_exe:
        profile_dir = get_browser_profile_dir()
        args = [
            browser_exe,
            f"--app={url}",
            f"--user-data-dir={profile_dir}",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-features=Translate",
        ]
        logger.info(f"Launching app window with {browser_name}: {' '.join(args)}")
        proc = subprocess.Popen(
            args,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
        )
        return proc, browser_name
    else:
        # Fallback to default browser
        import webbrowser
        webbrowser.open(url)
        return None, "Default Browser"


def stop_server_process(proc: subprocess.Popen, timeout: float = 3.0) -> None:
    """Gracefully terminate a background server process."""
    if proc and proc.poll() is None:
        try:
            logger.info(f"Terminating background server process (PID: {proc.pid})")
            proc.terminate()
            proc.wait(timeout=timeout)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass


def get_icon_path() -> Optional[str]:
    """Get absolute path to the creativeos.ico icon file."""
    candidates = [
        os.path.join(ROOT_PATH, "00_System", "GUI", "public", "creativeos.ico"),
        os.path.join(ROOT_PATH, "00_System", "Config", "creativeos.ico"),
    ]
    for c in candidates:
        if os.path.isfile(c):
            return os.path.abspath(c)
    return None


def create_windows_shortcut(
    target_path: str,
    shortcut_path: str,
    arguments: str = "",
    icon_path: Optional[str] = None,
    description: str = "CreativeOS Studio Hub",
    working_dir: Optional[str] = None,
) -> bool:
    """Create a Windows .lnk shortcut using Windows Script Host (cscript)."""
    if sys.platform != "win32":
        return False

    import tempfile
    working_dir = working_dir or str(Path(ROOT_PATH).resolve())
    icon_path = icon_path or get_icon_path() or target_path

    def vbs_str(s: str) -> str:
        return '"' + str(s).replace('"', '""') + '"'

    vbs_content = f"""Set WshShell = CreateObject("WScript.Shell")
Set Shortcut = WshShell.CreateShortcut({vbs_str(shortcut_path)})
Shortcut.TargetPath = {vbs_str(target_path)}
Shortcut.Arguments = {vbs_str(arguments)}
Shortcut.WorkingDirectory = {vbs_str(working_dir)}
Shortcut.IconLocation = {vbs_str(f"{icon_path},0")}
Shortcut.Description = {vbs_str(description)}
Shortcut.Save
"""

    temp_vbs = None
    try:
        with tempfile.NamedTemporaryFile("w", suffix=".vbs", delete=False, encoding="utf-8") as f:
            f.write(vbs_content)
            temp_vbs = f.name

        res = subprocess.run(
            ["cscript", "//nologo", temp_vbs],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return res.returncode == 0 and os.path.isfile(shortcut_path)
    except Exception as e:
        logger.error(f"Failed to create Windows shortcut: {e}")
        return False
    finally:
        if temp_vbs and os.path.isfile(temp_vbs):
            try:
                os.remove(temp_vbs)
            except Exception:
                pass


def build_native_executable() -> Optional[str]:
    """Compile Launcher.cs into CreativeOS.exe using the built-in Windows C# compiler."""
    if sys.platform != "win32":
        return None

    cs_source = os.path.join(ROOT_PATH, "00_System", "Scripts", "Launcher.cs")
    if not os.path.isfile(cs_source):
        logger.warning(f"C# launcher source not found at {cs_source}")
        return None

    out_exe = os.path.join(ROOT_PATH, "CreativeOS.exe")
    icon_path = os.path.join(ROOT_PATH, "00_System", "Config", "creativeos.ico")

    # Locate csc.exe compiler (standard on all Windows 10/11 installations)
    csc_candidates = [
        r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
        r"C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe",
        "csc.exe",
    ]
    csc_exe = None
    for c in csc_candidates:
        if os.path.isfile(c) or shutil.which(c):
            csc_exe = c
            break

    if not csc_exe:
        logger.warning("No C# compiler (csc.exe) found on system.")
        return None

    cmd = [
        csc_exe,
        "/target:winexe",
        "/optimize+",
    ]
    if os.path.isfile(icon_path):
        cmd.append(f"/win32icon:{icon_path}")
    cmd.extend([f"/out:{out_exe}", cs_source])

    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if res.returncode == 0 and os.path.isfile(out_exe):
            logger.info(f"Successfully compiled native CreativeOS.exe at {out_exe}")
            # Mirror to LocalAppData
            local_appdata = os.environ.get("LOCALAPPDATA", "")
            if local_appdata:
                target_dir = os.path.join(local_appdata, "CreativeOS")
                os.makedirs(target_dir, exist_ok=True)
                shutil.copy2(out_exe, os.path.join(target_dir, "CreativeOS.exe"))
            return out_exe
        else:
            logger.warning(f"Compilation error: {res.stderr or res.stdout}")
    except Exception as e:
        logger.warning(f"Failed to compile native executable: {e}")

    return None


def register_uri_protocol() -> bool:
    """Register creativeos:// custom URI scheme in HKCU."""
    if sys.platform != "win32":
        return False
    try:
        import winreg
        exe_path = os.path.join(ROOT_PATH, "CreativeOS.exe")
        if not os.path.isfile(exe_path):
            return False
        key_path = r"Software\Classes\creativeos"
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key_path) as key:
            winreg.SetValueEx(key, "", 0, winreg.REG_SZ, "URL:CreativeOS Protocol")
            winreg.SetValueEx(key, "URL Protocol", 0, winreg.REG_SZ, "")
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key_path + r"\shell\open\command") as key:
            winreg.SetValueEx(key, "", 0, winreg.REG_SZ, f'"{exe_path}" "%1"')
        return True
    except Exception as e:
        logger.warning(f"Could not register creativeos:// protocol: {e}")
        return False


def install_desktop_shortcuts() -> list[str]:
    """Install CreativeOS shortcuts on Desktop, Start Menu, and CreativeOS Root."""
    if sys.platform != "win32":
        return []

    target_exe = os.path.join(ROOT_PATH, "CreativeOS.exe")
    if not os.path.isfile(target_exe):
        built = build_native_executable()
        if built:
            target_exe = built

    register_uri_protocol()

    arguments = ""
    if not os.path.isfile(target_exe):
        target_exe = find_python_executable(gui=True)
        launcher_py = os.path.join(ROOT_PATH, "00_System", "Scripts", "cos", "launcher.py")
        arguments = f'"{launcher_py}"'

    icon_path = get_icon_path() or ""
    created_paths: list[str] = []

    # 1. Root Directory Shortcut
    root_shortcut = os.path.join(ROOT_PATH, "CreativeOS.lnk")
    if create_windows_shortcut(
        target_path=target_exe,
        shortcut_path=root_shortcut,
        arguments=arguments,
        icon_path=icon_path,
        description="CreativeOS Studio Hub",
    ):
        created_paths.append(root_shortcut)

    # 2. User Desktop Shortcut
    desktop_dir = os.path.join(os.environ.get("USERPROFILE", os.path.expanduser("~")), "Desktop")
    if os.path.isdir(desktop_dir):
        desktop_shortcut = os.path.join(desktop_dir, "CreativeOS.lnk")
        if create_windows_shortcut(
            target_path=target_exe,
            shortcut_path=desktop_shortcut,
            arguments=arguments,
            icon_path=icon_path,
            description="CreativeOS Studio Hub",
        ):
            created_paths.append(desktop_shortcut)

    # 3. Start Menu Shortcut
    appdata = os.environ.get("APPDATA", "")
    if appdata:
        start_menu_programs = os.path.join(appdata, "Microsoft", "Windows", "Start Menu", "Programs")
        if os.path.isdir(start_menu_programs):
            start_shortcut = os.path.join(start_menu_programs, "CreativeOS.lnk")
            if create_windows_shortcut(
                target_path=target_exe,
                shortcut_path=start_shortcut,
                arguments=arguments,
                icon_path=icon_path,
                description="CreativeOS Studio Hub",
            ):
                created_paths.append(start_shortcut)

    return created_paths


def run_app_lifecycle(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT, reload: bool = False) -> int:
    """Run the self-contained desktop application launch.
    
    1. Checks if server is already running on host:port.
    2. If running: Attaches app window directly.
    3. If NOT running: Starts silent background server with managed heartbeat lifecycle,
       then launches standalone app window.
    """
    url = f"http://{host}:{port}"

    if is_server_running(host, port):
        logger.info(f"CreativeOS server is already running at {url}. Attaching app window.")
    else:
        logger.info(f"No running server detected at {url}. Starting managed background server...")
        try:
            start_background_server(host=host, port=port, reload=reload)
        except Exception as e:
            logger.error(f"Failed to start background server: {e}")
            if hasattr(sys, "ps1") or (hasattr(sys.stdout, "isatty") and sys.stdout.isatty()):
                console.print(f"[bold red]❌ Failed to start CreativeOS server:[/bold red] {e}")
            return 1

    # Launch the App Window
    launch_app_window(url)
    return 0


if __name__ == "__main__":
    # Direct execution entry point
    sys.exit(run_app_lifecycle())

"""Unit and integration tests for the self-contained desktop app launcher and lifecycle."""

import os
import sys
import unittest
from unittest.mock import patch, MagicMock
import subprocess

from cos.launcher import (
    is_server_running,
    find_python_executable,
    find_app_browser,
    get_browser_profile_dir,
    get_icon_path,
    stop_server_process,
    run_app_lifecycle,
    install_desktop_shortcuts,
)
from cos.commands import app as cmd_app_module, gui as cmd_gui_module
from cos.help_formatter import RichArgumentParser


class TestServerHealthCheck(unittest.TestCase):
    """Test server health detection logic."""

    @patch("urllib.request.urlopen")
    def test_is_server_running_true(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        self.assertTrue(is_server_running("127.0.0.1", 8787))

    @patch("urllib.request.urlopen")
    def test_is_server_running_false(self, mock_urlopen):
        import urllib.error
        mock_urlopen.side_effect = urllib.error.URLError("Connection refused")

        self.assertFalse(is_server_running("127.0.0.1", 8787))


class TestLauncherEnvironment(unittest.TestCase):
    """Test launcher paths, browser detection, and environment preparation."""

    def test_find_python_executable(self):
        exe = find_python_executable(gui=True)
        self.assertIsInstance(exe, str)
        self.assertTrue(os.path.exists(exe) or exe.endswith(".exe"))

    def test_find_app_browser(self):
        browser_path, browser_name = find_app_browser()
        self.assertIsInstance(browser_name, str)
        if browser_path:
            self.assertTrue(os.path.isfile(browser_path))

    def test_get_browser_profile_dir(self):
        profile_dir = get_browser_profile_dir()
        self.assertTrue(os.path.isdir(profile_dir))
        self.assertIn("BrowserProfile", profile_dir)

    def test_get_icon_path(self):
        icon_path = get_icon_path()
        self.assertIsNotNone(icon_path)
        self.assertTrue(os.path.isfile(icon_path))
        self.assertTrue(icon_path.endswith(".ico"))


class TestAppLifecycle(unittest.TestCase):
    """Test lifecycle orchestration for both managed and unmanaged servers."""

    @patch("cos.launcher.is_server_running", return_value=True)
    @patch("cos.launcher.launch_app_window")
    @patch("cos.launcher.start_background_server")
    def test_lifecycle_reuses_existing_server(self, mock_start, mock_launch, mock_health):
        mock_launch.return_value = (None, "Microsoft Edge")

        ret = run_app_lifecycle(host="127.0.0.1", port=8787)
        self.assertEqual(ret, 0)
        # When server was already running, background server should NOT be started
        mock_start.assert_not_called()
        mock_launch.assert_called_once_with("http://127.0.0.1:8787")

    @patch("cos.launcher.is_server_running", return_value=False)
    @patch("cos.launcher.start_background_server")
    @patch("cos.launcher.launch_app_window")
    def test_lifecycle_starts_managed_server_when_stopped(
        self, mock_launch, mock_start, mock_health
    ):
        mock_server = MagicMock()
        mock_start.return_value = mock_server
        mock_launch.return_value = (None, "Microsoft Edge")

        ret = run_app_lifecycle(host="127.0.0.1", port=8787)
        self.assertEqual(ret, 0)
        # Background server MUST be started when offline
        mock_start.assert_called_once_with(host="127.0.0.1", port=8787, reload=False)
        mock_launch.assert_called_once_with("http://127.0.0.1:8787")

    def test_stop_server_process_graceful(self):
        mock_proc = MagicMock()
        mock_proc.poll.return_value = None
        stop_server_process(mock_proc)
        mock_proc.terminate.assert_called_once()
        mock_proc.wait.assert_called_once()


class TestCliParsers(unittest.TestCase):
    """Test argparse integration for cos app and cos gui."""

    def test_app_parser(self):
        parser = RichArgumentParser(prog="cos")
        subparsers = parser.add_subparsers(dest="command")
        cmd_app_module.add_parser(subparsers)

        args = parser.parse_args(["app", "-p", "9090", "--install-shortcut"])
        self.assertEqual(args.command, "app")
        self.assertEqual(args.port, 9090)
        self.assertTrue(args.install_shortcut)

    def test_gui_app_flags(self):
        parser = RichArgumentParser(prog="cos")
        subparsers = parser.add_subparsers(dest="command")
        cmd_gui_module.add_parser(subparsers)

        args = parser.parse_args(["gui", "--app", "--install-shortcut"])
        self.assertEqual(args.command, "gui")
        self.assertTrue(args.app)
        self.assertTrue(args.install_shortcut)


if __name__ == "__main__":
    unittest.main()

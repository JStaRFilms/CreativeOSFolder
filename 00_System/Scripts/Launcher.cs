using System;
using System.Collections;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;

namespace CreativeOSLauncher
{
    class Program
    {
        private static string _logPath = "";

        private static void Log(string msg)
        {
            try
            {
                if (!string.IsNullOrEmpty(_logPath))
                {
                    File.AppendAllText(_logPath, "[" + DateTime.Now.ToString("s") + "] " + msg + Environment.NewLine);
                }
            }
            catch { }
        }

        [STAThread]
        static void Main(string[] args)
        {
            string host = "127.0.0.1";
            int port = 8787;
            string url = "http://" + host + ":" + port;

            string rootDir = AppDomain.CurrentDomain.BaseDirectory;
            if (!Directory.Exists(Path.Combine(rootDir, "00_System")))
            {
                string candidate = @"C:\CreativeOS";
                if (Directory.Exists(candidate))
                {
                    rootDir = candidate;
                }
            }

            string scriptsDir = Path.Combine(rootDir, "00_System", "Scripts");
            _logPath = Path.Combine(rootDir, "00_System", "Config", "launcher.log");

            Log("=== CreativeOS Launcher Invoked ===");

            // 1. Check if server is already running
            if (!IsServerHealthy(url + "/api/health"))
            {
                Log("Server is offline. Launching background process...");
                string pythonExe = FindPython();
                Log("Using python: " + pythonExe);

                string managePy = Path.Combine(scriptsDir, "manage.py");
                ProcessStartInfo serverInfo = new ProcessStartInfo();
                serverInfo.FileName = pythonExe;
                serverInfo.Arguments = "\"" + managePy + "\" gui --no-browser --port " + port;
                serverInfo.WorkingDirectory = scriptsDir;
                serverInfo.UseShellExecute = false;
                serverInfo.CreateNoWindow = true;
                serverInfo.WindowStyle = ProcessWindowStyle.Hidden;

                // Inherit environment variables
                foreach (DictionaryEntry de in Environment.GetEnvironmentVariables())
                {
                    string key = de.Key.ToString();
                    if (!serverInfo.EnvironmentVariables.ContainsKey(key))
                    {
                        serverInfo.EnvironmentVariables[key] = de.Value.ToString();
                    }
                }

                serverInfo.EnvironmentVariables["PYTHONPATH"] = scriptsDir;
                serverInfo.EnvironmentVariables["CREATIVEOS_MANAGED"] = "1";

                try
                {
                    Process p = Process.Start(serverInfo);
                    Log("Server process spawned with PID: " + (p != null ? p.Id.ToString() : "null"));
                }
                catch (Exception ex)
                {
                    Log("Process.Start failed: " + ex.ToString());
                }

                // Wait up to 6 seconds for server health
                bool ready = false;
                for (int i = 0; i < 60; i++)
                {
                    Thread.Sleep(100);
                    if (IsServerHealthy(url + "/api/health"))
                    {
                        ready = true;
                        Log("Server confirmed healthy after " + ((i + 1) * 100) + "ms");
                        break;
                    }
                }
                if (!ready)
                {
                    Log("Server did not report healthy within timeout.");
                }
            }
            else
            {
                Log("Server is already running.");
            }

            // 2. Launch Microsoft Edge PWA or App Mode (if not a silent protocol wake-up)
            bool isProtocolCall = args != null && args.Length > 0 && args[0].ToLower().StartsWith("creativeos://");
            if (isProtocolCall)
            {
                Log("Protocol wake-up invocation complete. Backend ready.");
                return;
            }

            LaunchEdgeApp(url);
        }

        static void LaunchEdgeApp(string url)
        {
            // Check for Edge Proxy executable
            string edgeProxy = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge_proxy.exe";
            if (!File.Exists(edgeProxy))
            {
                edgeProxy = @"C:\Program Files\Microsoft\Edge\Application\msedge_proxy.exe";
            }

            // Look for installed CreativeOS PWA App ID in Edge Web Applications
            string webAppsDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                @"Microsoft\Edge\User Data\Default\Web Applications"
            );

            string foundAppId = null;
            if (Directory.Exists(webAppsDir))
            {
                foreach (string dir in Directory.GetDirectories(webAppsDir, "_crx__*"))
                {
                    if (File.Exists(Path.Combine(dir, "CreativeOS.ico")))
                    {
                        string dirName = Path.GetFileName(dir);
                        if (dirName.StartsWith("_crx__"))
                        {
                            foundAppId = dirName.Substring(6);
                            break;
                        }
                    }
                }
            }

            // 1. If Edge PWA App ID is found, launch via msedge_proxy for exact PWA window
            if (File.Exists(edgeProxy) && !string.IsNullOrEmpty(foundAppId))
            {
                Log("Launching Edge PWA with App ID: " + foundAppId);
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = edgeProxy;
                psi.Arguments = "--profile-directory=Default --app-id=" + foundAppId + " --app-url=" + url + " --app-launch-source=4";
                psi.UseShellExecute = true;
                try
                {
                    Process.Start(psi);
                    Log("Edge PWA launched successfully.");
                    return;
                }
                catch (Exception ex)
                {
                    Log("Failed to launch via msedge_proxy: " + ex.ToString());
                }
            }

            // 2. Direct msedge.exe --app fallback
            string edgeExe = FindEdge();
            if (!string.IsNullOrEmpty(edgeExe) && File.Exists(edgeExe))
            {
                Log("Launching Edge directly with --app=" + url);
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = edgeExe;
                psi.Arguments = "--app=" + url;
                psi.UseShellExecute = true;
                try
                {
                    Process.Start(psi);
                    Log("Edge --app launched successfully.");
                    return;
                }
                catch (Exception ex)
                {
                    Log("Failed to launch msedge --app: " + ex.ToString());
                }
            }

            // 3. Fallback: Default Browser
            try
            {
                Log("Launching default browser: " + url);
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch (Exception ex)
            {
                Log("Failed to launch default browser: " + ex.ToString());
            }
        }

        static bool IsServerHealthy(string url)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                req.Timeout = 350;
                req.Method = "GET";
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    return resp.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }

        static string FindPython()
        {
            string[] candidates = new string[]
            {
                @"C:\Python314\python.exe",
                @"C:\Program Files\Python311\python.exe",
                @"C:\Python313\python.exe",
                @"C:\Python312\python.exe",
                @"C:\Python311\python.exe",
            };
            foreach (string c in candidates)
            {
                if (File.Exists(c)) return c;
            }
            return "python.exe";
        }

        static string FindEdge()
        {
            string[] candidates = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe"),
            };
            foreach (string c in candidates)
            {
                if (File.Exists(c)) return c;
            }
            return "";
        }
    }
}

using System;
using System.Collections;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Threading;

namespace CreativeOSLauncher
{
    class Program
    {
        private static string _logPath = "";

        [DllImport("shell32.dll", SetLastError = true)]
        private static extern void SetCurrentProcessExplicitAppUserModelID([MarshalAs(UnmanagedType.LPWStr)] string AppID);

        [ComImport]
        [Guid("00021401-0000-0000-C000-000000000046")]
        internal class ShellLink {}

        [ComImport]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        [Guid("000214F9-0000-0000-C000-000000000046")]
        internal interface IShellLinkW
        {
            void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszFile, int cchMaxPath, out IntPtr pfd, int fFlags);
            void GetIDList(out IntPtr ppidl);
            void SetIDList(IntPtr pidl);
            void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszName, int cchMaxName);
            void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
            void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszDir, int cchMaxPath);
            void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
            void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszArgs, int cchMaxPath);
            void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
            void GetHotkey(out short pwHotkey);
            void SetHotkey(short wHotkey);
            void GetShowCmd(out int piShowCmd);
            void SetShowCmd(int iShowCmd);
            void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder pszIconPath, int cchIconPath, out int piIcon);
            void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
            void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, int dwReserved);
            void Resolve(IntPtr hwnd, int fFlags);
            void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
        }

        [ComImport]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        [Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
        internal interface IPropertyStore
        {
            void GetCount(out uint cProps);
            void GetAt(uint iProp, out PropertyKey pkey);
            void GetValue(ref PropertyKey key, out PropVariant pv);
            void SetValue(ref PropertyKey key, ref PropVariant pv);
            void Commit();
        }

        [StructLayout(LayoutKind.Sequential, Pack = 4)]
        internal struct PropertyKey
        {
            public Guid fmtid;
            public uint pid;

            public PropertyKey(Guid guid, uint id)
            {
                fmtid = guid;
                pid = id;
            }
        }

        [StructLayout(LayoutKind.Explicit)]
        internal struct PropVariant
        {
            [FieldOffset(0)] public ushort vt;
            [FieldOffset(8)] public IntPtr pwszVal;

            public static PropVariant FromString(string val)
            {
                PropVariant pv = new PropVariant();
                pv.vt = 31; // VT_LPWSTR
                pv.pwszVal = Marshal.StringToCoTaskMemUni(val);
                return pv;
            }
        }

        private static readonly PropertyKey AppUserModelIDKey = new PropertyKey(
            new Guid("9F4C2855-9F79-4B39-A8E0-E13A2F299A7D"), 5);

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

        public static void CreateWindowsShortcut(string targetPath, string shortcutPath, string iconPath, string arguments, string aumid)
        {
            try
            {
                string dir = Path.GetDirectoryName(shortcutPath);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }

                IShellLinkW link = (IShellLinkW)new ShellLink();
                link.SetPath(targetPath);
                if (!string.IsNullOrEmpty(arguments)) link.SetArguments(arguments);
                if (!string.IsNullOrEmpty(iconPath)) link.SetIconLocation(iconPath, 0);
                link.SetWorkingDirectory(Path.GetDirectoryName(targetPath));
                link.SetDescription("CreativeOS Studio Hub");

                if (!string.IsNullOrEmpty(aumid))
                {
                    IPropertyStore store = (IPropertyStore)link;
                    PropVariant pv = PropVariant.FromString(aumid);
                    PropertyKey key = AppUserModelIDKey;
                    store.SetValue(ref key, ref pv);
                    store.Commit();
                }

                IPersistFile file = (IPersistFile)link;
                file.Save(shortcutPath, true);
                Log("Created shortcut with AUMID [" + aumid + "] at " + shortcutPath);
            }
            catch (Exception ex)
            {
                Log("Failed to create shortcut at " + shortcutPath + ": " + ex.Message);
            }
        }

        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                SetCurrentProcessExplicitAppUserModelID("MSEdge");
            }
            catch { }

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

            // Handle --install-shortcuts argument
            if (args != null && args.Length > 0 && args[0].ToLower() == "--install-shortcuts")
            {
                string targetExe = Path.Combine(rootDir, "CreativeOS.exe");
                string iconPath = Path.Combine(rootDir, "00_System", "GUI", "public", "creativeos.ico");
                if (!File.Exists(iconPath))
                {
                    iconPath = Path.Combine(rootDir, "00_System", "Config", "creativeos.ico");
                }

                // 1. Root Shortcut
                CreateWindowsShortcut(targetExe, Path.Combine(rootDir, "CreativeOS.lnk"), iconPath, "", "MSEdge");

                // 2. Desktop Shortcut
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                if (!string.IsNullOrEmpty(desktop))
                {
                    CreateWindowsShortcut(targetExe, Path.Combine(desktop, "CreativeOS.lnk"), iconPath, "", "MSEdge");
                }

                // 3. Start Menu Shortcut
                string startMenu = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    @"Microsoft\Windows\Start Menu\Programs"
                );
                if (!string.IsNullOrEmpty(startMenu))
                {
                    CreateWindowsShortcut(targetExe, Path.Combine(startMenu, "CreativeOS.lnk"), iconPath, "", "MSEdge");
                }

                Console.WriteLine("Shortcuts installed successfully with Taskbar AUMID grouping.");
                return;
            }

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

            // 2. Launch Microsoft Edge in App Mode
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
            string edgeProxy = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge_proxy.exe";
            if (!File.Exists(edgeProxy))
            {
                edgeProxy = @"C:\Program Files\Microsoft\Edge\Application\msedge_proxy.exe";
            }

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

            // 1. If Edge PWA App ID is found, launch via msedge_proxy
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

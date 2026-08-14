' CreativeOS Standalone Desktop App Launcher
' Starts CreativeOS in silent, self-contained desktop mode with zero console window flash.

Dim objShell, strScriptDir, strCommand
Set objShell = CreateObject("WScript.Shell")

' Get directory where this VBS file is located
strScriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

' Execute pythonw silently (window style 0 = hidden)
strCommand = "pythonw.exe """ & strScriptDir & "\cos\launcher.py"""
objShell.CurrentDirectory = strScriptDir
objShell.Run strCommand, 0, False

Set objShell = Nothing

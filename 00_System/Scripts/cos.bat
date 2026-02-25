@echo off
REM CreativeOS CLI Entry Point
REM Uses %~dp0 to get the script's directory for portability

python "%~dp0manage.py" %*
@echo off
cd /d "%~dp0"
set "SALONEY_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "SALONEY_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%SALONEY_NODE%" --env-file-if-exists=.env scripts/start.js --open
pause

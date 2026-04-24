@echo off
setlocal
PowerShell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-project.ps1" %*

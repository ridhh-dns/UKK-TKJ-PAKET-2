@echo off
REM start-ai-backend-background.cmd
REM Meluncurkan watchdog AI backend (port 3001) di background tanpa jendela.
REM Dipakai manual; di startup Windows otomatis lewat Task Scheduler.
start "AI Backend Runner" /min powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0ai-backend-runner.ps1"

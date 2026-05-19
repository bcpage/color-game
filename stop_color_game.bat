@echo off
title Stop Colour Game
echo Stopping Colour Game server...
taskkill /f /im node.exe >nul 2>&1
echo Done. All Node.js processes stopped.
timeout /t 2 > nul

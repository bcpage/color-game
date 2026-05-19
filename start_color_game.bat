@echo off
title Colour Game Server
echo ========================================
echo   Starting Colour Game Server...
echo ========================================
echo.
cd /d C:\Node_js\color_game
node server.js
echo.
echo Server stopped. Press any key to close.
pause > nul

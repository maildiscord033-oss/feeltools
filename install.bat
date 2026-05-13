@echo off
title FEEL STORE - Installer
color a
echo.
echo ==========================================
echo    FEEL STORE - Installing Dependencies
echo ==========================================
echo.

cd /d "%~dp0"

echo [+] Clearing old node_modules...
rmdir /s /q node_modules 2>nul
del /f /q package-lock.json 2>nul

echo.
echo [+] Installing packages...
echo.

call npm install express socket.io axios discord.js dotenv crypto-js express-rate-limit helmet cors node-machine-id chalk open@10.0.3

echo.
echo ==========================================
echo    [SUCCESS] Installation Complete!
echo    Run: node .
echo ==========================================
echo.
pause
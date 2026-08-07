@echo off
title 🍺 DRINK BEER! Party Game Server
color 0A
setlocal enabledelayedexpansion

echo.
echo ======================================================
echo   🍺 DRINK BEER! — Automatic Party Installer (Windows)
echo ======================================================
echo.

:: Check if Node.js & npm are installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️ Node.js is not installed! Attempting automatic installation...
    echo.

    :: Try installing via winget first
    where winget >nul 2>nul
    if !errorlevel! equ 0 (
        echo ⚡ Installing Node.js via winget...
        winget install --id OpenJS.NodeJS -e --source winget --accept-package-agreements --accept-source-agreements
    ) else (
        echo ⚡ Downloading official Node.js installer...
        powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi' -OutFile '%TEMP%\node-installer.msi'"
        echo ⚡ Installing Node.js...
        msiexec /i "%TEMP%\node-installer.msi" /qb
    )

    :: Refresh PATH for current command prompt session
    set "PATH=%ProgramFiles%\nodejs\;%APPDATA%\npm;%PATH%"
    echo.
    echo ✅ Node.js installation finished!
)

:: Re-verify node after install
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Please restart your command prompt window or computer to finish Node.js installation, then run install.bat again.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo ✅ Node.js: %NODE_VER%
echo.

:: Install dependencies
echo 📦 Checking and installing dependencies...
call npm install
echo.

echo ======================================================
echo   🚀 Starting DRINK BEER Party Game!
echo ======================================================
echo.
echo 🖥️ Host Display:  http://localhost:3000
echo 📱 Player Link:   http://localhost:3000/play
echo.
echo Opening browser tabs automatically in 2 seconds...
echo.

:: Open Host Display and Player tabs in default browser
start "" "http://localhost:3000"
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000/play"

:: Start server
call npm start

pause

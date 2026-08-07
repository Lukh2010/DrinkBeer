@echo off
echo.
echo ======================================================
echo   🍺 DRINK BEER! — Party Game Installer (Windows)
echo ======================================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed!
    echo.
    echo Download and install it from:
    echo   https://nodejs.org/
    echo.
    echo After installing, restart this script.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo ✅ Node.js found: %NODE_VER%

:: Check for npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm is not installed! Install it alongside Node.js.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i
echo ✅ npm found: %NPM_VER%
echo.

:: Install dependencies
echo 📦 Installing dependencies...
call npm install
echo.

echo ======================================================
echo   ✅ Installation complete!
echo ======================================================
echo.
echo Starting the game server...
echo.

:: Open browser after a short delay
start "" "http://localhost:3000"

:: Start server
call npm start

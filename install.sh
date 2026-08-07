#!/usr/bin/env bash
set -e

echo ""
echo "======================================================"
echo "  🍺 DRINK BEER! — Party Game Installer (Linux/macOS)"
echo "======================================================"
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo ""
    echo "Install it first:"
    echo "  Ubuntu/Debian:  sudo apt install nodejs npm"
    echo "  Fedora:         sudo dnf install nodejs npm"
    echo "  Arch:           sudo pacman -S nodejs npm"
    echo "  macOS:          brew install node"
    echo "  Or download:    https://nodejs.org/"
    echo ""
    exit 1
fi

NODE_VER=$(node -v)
echo "✅ Node.js found: $NODE_VER"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed! Install it alongside Node.js."
    exit 1
fi

echo "✅ npm found: $(npm -v)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo ""

# Done — start the server
echo "======================================================"
echo "  ✅ Installation complete!"
echo "======================================================"
echo ""
echo "Starting the game server..."
echo ""

# Open browser after a short delay
(sleep 2 && xdg-open "http://localhost:3000" 2>/dev/null || open "http://localhost:3000" 2>/dev/null) &

npm start

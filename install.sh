#!/usr/bin/env bash
set -e

echo ""
echo "======================================================"
echo "  🍺 DRINK BEER! — Automatic Party Installer (Linux/macOS)"
echo "======================================================"
echo ""

# Helper to check command existence
has_cmd() {
    command -v "$1" &> /dev/null
}

# Auto-install Node.js & npm if missing
if ! has_cmd node || ! has_cmd npm; then
    echo "⚠️ Node.js / npm not found! Attempting automatic installation..."
    echo ""
    if has_cmd apt-get; then
        echo "⚡ Detected Debian/Ubuntu (apt). Installing nodejs & npm..."
        sudo apt-get update && sudo apt-get install -y nodejs npm
    elif has_cmd dnf; then
        echo "⚡ Detected Fedora/RHEL (dnf). Installing nodejs & npm..."
        sudo dnf install -y nodejs npm
    elif has_cmd pacman; then
        echo "⚡ Detected Arch Linux (pacman). Installing nodejs & npm..."
        sudo pacman -Sy --noconfirm nodejs npm
    elif has_cmd brew; then
        echo "⚡ Detected macOS (Homebrew). Installing node..."
        brew install node
    else
        echo "❌ Could not auto-detect package manager."
        echo "Please install Node.js manually from https://nodejs.org/"
        exit 1
    fi
    echo ""
fi

NODE_VER=$(node -v)
NPM_VER=$(npm -v)
echo "✅ Node.js: $NODE_VER"
echo "✅ npm:     $NPM_VER"
echo ""

# Install npm dependencies if node_modules missing or needed
echo "📦 Checking and installing dependencies..."
npm install
echo ""

echo "======================================================"
echo "  🚀 Starting DRINK BEER Party Game!"
echo "======================================================"
echo ""
echo "🖥️ Host Display:  http://localhost:3000"
echo "📱 Player Link:   http://localhost:3000/play"
echo ""
echo "Opening browser tabs automatically in 2 seconds..."
echo ""

# Auto-open browser tabs for host display and test player
(
    sleep 2
    if has_cmd xdg-open; then
        xdg-open "http://localhost:3000" 2>/dev/null || true
        sleep 1
        xdg-open "http://localhost:3000/play" 2>/dev/null || true
    elif has_cmd open; then
        open "http://localhost:3000" 2>/dev/null || true
        sleep 1
        open "http://localhost:3000/play" 2>/dev/null || true
    fi
) &

# Start the game server
npm start

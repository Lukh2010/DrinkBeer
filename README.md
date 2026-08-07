# 🍺 DRINK BEER! — Local Party Drinking Game

A local multiplayer party drinking game for PC with **phone-as-controller** support. Players scan a QR code with their phones to join — no app install needed. Features a dynamic penalty wheel, drink inventory tracking, mini-games, and a host admin panel.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)
![License](https://img.shields.io/badge/License-MIT-blue)
![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20Windows%20%7C%20macOS-lightgrey)

---

## ⚡ Quick Install

### Linux / macOS

```bash
git clone https://github.com/Lukh2010/DrinkBeer.git
cd DrinkBeer
chmod +x install.sh
./install.sh
```

### Windows

```powershell
git clone https://github.com/Lukh2010/DrinkBeer.git
cd DrinkBeer
DrinkBeer.bat
```

Both scripts will:
1. Check if Node.js is installed (and tell you where to get it if not)
2. Run `npm install` to grab dependencies
3. Start the game server
4. Open the host display in your default browser

---

## 🎮 How to Play

### Setup
1. **Launch the app** using the install script or `npm start`
2. **Add your drinks** — Click the green **＋** button to open the drink library. Pick from 35+ drinks (beers, spirits, wine, cocktails, soft drinks) or create custom ones. Set exact quantities for each.
3. **Players join** — Friends scan the QR code on the big screen with their phone camera (same Wi-Fi network). No app download needed.
4. **Start the game!**

### Gameplay
The game runs in **rounds**, cycling between prompts and mini-games:

| Game Type | How It Works |
|---|---|
| 🗳️ **Most Likely To** | Everyone secretly votes on their phone. Most votes = drinks! |
| 🙅 **Never Have I Ever** | Tap "I Have" or "Never" on your phone. Everyone who's done it drinks! |
| ⚡ **Speed Buzzer** | Wait for GREEN, then tap your phone ASAP. Slowest player drinks! |
| 🍻 **Button Mash Duel** | Two players furiously tap their screens. Loser drinks! |
| 💣 **Bomb Pass** | Pass the ticking bomb to another player before it explodes! |
| 🧠 **Speed Trivia** | Answer on your phone. Wrong answers drink! |

### The Wheel
When you lose a round, the **Wheel of Punishment** spins to decide what you drink. The wheel only shows drinks that are still in stock — when a drink runs out, it disappears from the wheel automatically!

### Admin Panel
Click **⚙️ Admin Panel** on the top right of the PC screen to:
- ➕/➖ Adjust drink stock live
- 🌀 Force a wheel spin on a random player
- ⏩ Skip rounds
- 👢 Kick players
- 🔄 Reset the entire game

---

## 🛠️ Manual Setup

**Prerequisites:** [Node.js](https://nodejs.org/) v18 or higher

```bash
# Clone the repo
git clone https://github.com/Lukh2010/DrinkBeer.git
cd DrinkBeer

# Install dependencies
npm install

# Start the server
npm start
```

Then open **http://localhost:3000** in your browser.

---

## 📁 Project Structure

```
DrinkBeer/
├── README.md                 # Project Documentation
├── DrinkBeer.bat             # Windows App Launcher / Shortcut
├── install.sh                # Linux/macOS Installer Script
└── src/                      # Source Code Subfolder
    ├── server.js             # Express + Socket.io backend
    ├── package.json          # Node dependencies
    └── public/
        ├── host/             # PC big-screen display UI
        │   ├── index.html
        │   ├── style.css
        │   └── app.js
        └── mobile/           # Phone controller UI
            ├── index.html
            ├── style.css
            └── app.js
```

---

## 🍻 Drink Library

The built-in library includes 35+ drinks across categories:

- 🍺 **Beer** — Lager, Pilsner, Wheat Beer, IPA, Stout, Radler, Helles, Pale Ale
- 🥃 **Spirits** — Vodka, Tequila, Jägermeister, Whiskey, Rum, Sambuca, Gin, Absinthe, Fireball, Schnapps
- 🍷 **Wine** — Red Wine, White Wine, Rosé, Prosecco, Champagne
- 🍹 **Cocktails** — Mojito, Margarita, Long Island, Aperol Spritz, Piña Colada, Cuba Libre
- 💧 **Soft / NA** — Water, Cola, Juice, Energy Drink, Soda

You can also create **custom drinks** with your own name, unit type, and emoji icon.

---

## ⚠️ Disclaimer

Drink responsibly. This app is intended for entertainment among friends of legal drinking age. Know your limits. Never drink and drive.

---

## 📄 License

MIT License — do whatever you want with it. 🍻

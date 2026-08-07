const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const qrcode = require('qrcode');
const ip = require('ip');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const isTestMode = process.env.TEST_MODE === 'true' || process.argv.includes('--local');
const localIP = isTestMode ? '127.0.0.1' : ip.address();
const listenHost = isTestMode ? '127.0.0.1' : '0.0.0.0';
const connectUrl = `http://${localIP}:${PORT}/play`;

let cachedQrDataUrl = '';
qrcode.toDataURL(connectUrl, {
  width: 320,
  margin: 2,
  color: { dark: '#ffffff', light: '#0f172a' }
}).then(url => {
  cachedQrDataUrl = url;
}).catch(err => console.error('QR code generation error:', err));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host', 'index.html'));
});

app.get('/host', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host', 'index.html'));
});

app.get('/play', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mobile', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host', 'index.html'));
});

// API endpoint for QR code & connection info
app.get('/api/info', async (req, res) => {
  try {
    const qrDataUrl = await qrcode.toDataURL(connectUrl, {
      width: 320,
      margin: 2,
      color: { dark: '#ffffff', light: '#0f172a' }
    });
    res.json({
      ip: localIP,
      port: PORT,
      url: connectUrl,
      qr: qrDataUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Game State Management
let gameState = {
  phase: 'SETUP', // SETUP, LOBBY, CARD_PROMPT, MINI_GAME, RESULT, WHEEL_SPIN, PAUSED
  inventory: [
    { id: 'beer', name: 'Beer', count: 24, unit: 'Sip(s)', color: '#f59e0b', icon: '🍺' },
    { id: 'shot', name: 'Shot', count: 12, unit: 'Shot(s)', color: '#ef4444', icon: '🥃' },
    { id: 'cider', name: 'Cider', count: 12, unit: 'Sip(s)', color: '#10b981', icon: '🍏' },
    { id: 'cocktail', name: 'Cocktail', count: 10, unit: 'Sip(s)', color: '#ec4899', icon: '🍹' },
    { id: 'water', name: 'Water', count: 50, unit: 'Gulp(s)', color: '#3b82f6', icon: '💧' }
  ],
  players: {}, // socketId -> { id, name, avatar, color, totalSips, connected }
  roundNumber: 0,
  currentRound: null, // { type, prompt, options, data, losers: [] }
  activeLosers: [], // Players who need to spin wheel
  lastSpinResult: null,
  history: []
};

// Mini-game & Deck Database
const PROMPT_DECKS = [
  {
    type: 'MOST_LIKELY',
    title: 'Most Likely To',
    prompt: 'Who is most likely to text their ex tonight?',
    sub: 'Everyone vote on your phone!'
  },
  {
    type: 'MOST_LIKELY',
    title: 'Most Likely To',
    prompt: 'Who would survive the shortest time in a zombie apocalypse?',
    sub: 'Everyone vote on your phone!'
  },
  {
    type: 'MOST_LIKELY',
    title: 'Most Likely To',
    prompt: 'Who spends the most money on stupid things?',
    sub: 'Vote for the biggest spender!'
  },
  {
    type: 'MOST_LIKELY',
    title: 'Most Likely To',
    prompt: 'Who is the worst driver in the room?',
    sub: 'Cast your votes secretly!'
  },
  {
    type: 'NEVER_EVER',
    title: 'Never Have I Ever...',
    prompt: '...gotten a speeding ticket.',
    sub: 'Tap "I HAVE" or "NEVER" on your phone!'
  },
  {
    type: 'NEVER_EVER',
    title: 'Never Have I Ever...',
    prompt: '...lied about taking a drink.',
    sub: 'Be honest on your phone!'
  },
  {
    type: 'NEVER_EVER',
    title: 'Never Have I Ever...',
    prompt: '...sent a text to the wrong person embarrassingly.',
    sub: 'Tap your answer!'
  },
  {
    type: 'DARE_TRUTH',
    title: 'Wild Card Dare',
    prompt: 'Do 10 pushups right now or spin the wheel TWICE!',
    sub: 'Target player must choose or face punishment.'
  },
  {
    type: 'HOUSE_RULE',
    title: 'New House Rule!',
    prompt: 'No one is allowed to say the word "DRINK". Penalty: 1 Sip!',
    sub: 'Applies to all players until the next house rule!'
  }
];

const ACTION_MINI_GAMES = [
  {
    type: 'SPEED_BUZZER',
    title: '⚡ Quick Draw Buzzer',
    prompt: 'Wait for GREEN on your phone, then TAP BUZZER as fast as possible!',
    sub: 'Slowest player drinks!'
  },
  {
    type: 'TUG_OF_WAR',
    title: '🍻 Beer Pong Button Mash',
    prompt: 'Mash your phone screen furiously to push the beer glass!',
    sub: '2 Players chosen at random!'
  },
  {
    type: 'BOMB_PASS',
    title: '💣 Ticking Bomb Pass',
    prompt: 'The bomb is ticking on your phone! Answer or tap PASS before it explodes!',
    sub: 'Whoever holds the bomb when it blows loses!'
  },
  {
    type: 'TRIVIA',
    title: '🧠 Speed Trivia Quiz',
    prompt: 'Which planet is known as the Red Planet?',
    options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
    correct: 1,
    sub: 'Wrong answers drink! Fastest correct answer picks who drinks!'
  },
  {
    type: 'TRIVIA',
    title: '🧠 Speed Trivia Quiz',
    prompt: 'What is the chemical symbol for Gold?',
    options: ['Ag', 'Au', 'Fe', 'Hg'],
    correct: 1,
    sub: 'Test your knowledge!'
  }
];

// Helper: Available drinks (count > 0)
function getAvailableInventory() {
  return gameState.inventory.filter(item => item.count > 0);
}

// Socket Communication
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Send current state to newly connected client
  socket.emit('state:sync', {
    ...gameState,
    availableInventory: getAvailableInventory(),
    url: connectUrl,
    qr: cachedQrDataUrl,
    ip: localIP,
    port: PORT
  });

  // HOST: Initialize Drink Inventory
  socket.on('setup:init_inventory', (items) => {
    if (Array.isArray(items) && items.length > 0) {
      gameState.inventory = items.map((item, idx) => ({
        id: item.id || `drink_${idx}`,
        name: item.name || 'Drink',
        count: Math.max(0, parseInt(item.count) || 0),
        unit: item.unit || 'Sip(s)',
        color: item.color || ['#f59e0b', '#ef4444', '#10b981', '#ec4899', '#3b82f6', '#8b5cf6'][idx % 6],
        icon: item.icon || '🍺'
      }));
      gameState.phase = 'LOBBY';
      io.emit('state:sync', {
        ...gameState,
        availableInventory: getAvailableInventory()
      });
    }
  });

  // PLAYER: Join Room
  socket.on('player:join', ({ name, avatar }) => {
    if (!name) return;
    const cleanName = name.trim().substring(0, 16);
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];
    const playerColor = colors[Object.keys(gameState.players).length % colors.length];

    gameState.players[socket.id] = {
      id: socket.id,
      name: cleanName,
      avatar: avatar || '😎',
      color: playerColor,
      totalSips: 0,
      connected: true,
      currentVote: null,
      buzzerTime: null,
      mashCount: 0
    };

    console.log(`Player joined: ${cleanName} (${socket.id})`);
    io.emit('player:update', {
      players: gameState.players,
      newPlayerName: cleanName
    });
    io.emit('state:sync', { ...gameState, availableInventory: getAvailableInventory() });
  });

  // HOST: Start Game
  socket.on('game:start', () => {
    if (Object.keys(gameState.players).length === 0) {
      socket.emit('error:msg', 'At least 1 player must join before starting!');
      return;
    }
    gameState.phase = 'IN_ROUND';
    gameState.roundNumber = 1;
    triggerNewRound();
  });

  // HOST: Next Round
  socket.on('game:next_round', () => {
    gameState.roundNumber++;
    triggerNewRound();
  });

  // Trigger next round prompt or mini-game
  function triggerNewRound() {
    // Reset player round transient data
    Object.values(gameState.players).forEach(p => {
      p.currentVote = null;
      p.buzzerTime = null;
      p.mashCount = 0;
    });

    const isMiniGame = Math.random() < 0.45;
    let roundData;

    if (isMiniGame) {
      const template = ACTION_MINI_GAMES[Math.floor(Math.random() * ACTION_MINI_GAMES.length)];
      roundData = JSON.parse(JSON.stringify(template));

      if (roundData.type === 'TUG_OF_WAR') {
        const pKeys = Object.keys(gameState.players);
        if (pKeys.length >= 2) {
          const p1 = pKeys[0];
          const p2 = pKeys[1] || pKeys[0];
          roundData.duellists = [p1, p2];
        } else {
          roundData.duellists = [pKeys[0], pKeys[0]];
        }
      }
    } else {
      const template = PROMPT_DECKS[Math.floor(Math.random() * PROMPT_DECKS.length)];
      roundData = JSON.parse(JSON.stringify(template));
      
      // Inject random player name into prompts if needed
      const pNames = Object.values(gameState.players).map(p => p.name);
      if (pNames.length > 0) {
        const randomName = pNames[Math.floor(Math.random() * pNames.length)];
        roundData.prompt = roundData.prompt.replace('{player}', randomName);
      }
    }

    gameState.currentRound = roundData;
    gameState.phase = 'ROUND_ACTIVE';
    gameState.activeLosers = [];

    io.emit('game:round_started', {
      roundNumber: gameState.roundNumber,
      round: gameState.currentRound,
      players: gameState.players
    });
  }

  // PLAYER: Submit Prompt Vote / Action
  socket.on('player:submit_vote', ({ vote }) => {
    const player = gameState.players[socket.id];
    if (player && gameState.phase === 'ROUND_ACTIVE') {
      player.currentVote = vote;
      io.emit('player:vote_updated', {
        playerId: socket.id,
        playerName: player.name,
        hasVoted: true
      });

      // Check if all players voted
      const allPlayers = Object.values(gameState.players);
      const votedCount = allPlayers.filter(p => p.currentVote !== null).length;
      if (votedCount >= allPlayers.length) {
        evaluateRoundResults();
      }
    }
  });

  // PLAYER: Speed Buzzer Press
  socket.on('player:buzzer_press', ({ timeMs }) => {
    const player = gameState.players[socket.id];
    if (player && gameState.currentRound?.type === 'SPEED_BUZZER' && !player.buzzerTime) {
      player.buzzerTime = timeMs;
      io.emit('player:buzzer_recorded', {
        playerId: socket.id,
        name: player.name,
        timeMs
      });
    }
  });

  // PLAYER: Button Mash Increment
  socket.on('player:mash_tap', () => {
    const player = gameState.players[socket.id];
    if (player && gameState.currentRound?.type === 'TUG_OF_WAR') {
      player.mashCount = (player.mashCount || 0) + 1;
      io.emit('game:mash_update', {
        playerId: socket.id,
        mashCount: player.mashCount
      });
    }
  });

  // PLAYER: Bomb Pass
  socket.on('player:pass_bomb', ({ targetPlayerId }) => {
    if (gameState.currentRound?.type === 'BOMB_PASS') {
      gameState.currentRound.bombHolderId = targetPlayerId;
      io.emit('game:bomb_passed', {
        holderId: targetPlayerId,
        holderName: gameState.players[targetPlayerId]?.name || 'Someone'
      });
    }
  });

  // HOST: Evaluate Round & Calculate Loser(s)
  socket.on('game:eval_round', () => {
    evaluateRoundResults();
  });

  function evaluateRoundResults() {
    const round = gameState.currentRound;
    if (!round) return;

    let losers = [];
    let summaryText = '';

    if (round.type === 'MOST_LIKELY') {
      // Count votes for each player
      const voteCounts = {};
      Object.values(gameState.players).forEach(p => {
        if (p.currentVote) {
          voteCounts[p.currentVote] = (voteCounts[p.currentVote] || 0) + 1;
        }
      });

      let maxVotes = 0;
      Object.entries(voteCounts).forEach(([targetId, count]) => {
        if (count > maxVotes) {
          maxVotes = count;
          losers = [targetId];
        } else if (count === maxVotes && count > 0) {
          losers.push(targetId);
        }
      });

      const loserNames = losers.map(id => gameState.players[id]?.name || 'Unknown').join(', ');
      summaryText = losers.length > 0 ? `${loserNames} got the most votes (${maxVotes})!` : 'It was a tie!';
    } else if (round.type === 'NEVER_EVER') {
      // Losers are everyone who voted 'HAVE'
      Object.entries(gameState.players).forEach(([pId, p]) => {
        if (p.currentVote === 'HAVE') {
          losers.push(pId);
        }
      });
      summaryText = losers.length > 0 ? `${losers.length} player(s) have done it!` : 'No one has done it! Everyone drinks 1 sip!';
      if (losers.length === 0) {
        losers = Object.keys(gameState.players);
      }
    } else if (round.type === 'SPEED_BUZZER') {
      // Slowest player drinks
      let maxTime = -1;
      let slowest = null;
      Object.entries(gameState.players).forEach(([pId, p]) => {
        if (!p.buzzerTime) {
          losers.push(pId); // Did not press
        } else if (p.buzzerTime > maxTime) {
          maxTime = p.buzzerTime;
          slowest = pId;
        }
      });
      if (losers.length === 0 && slowest) {
        losers.push(slowest);
      }
      summaryText = `Slowest reaction time! ${gameState.players[slowest]?.name || 'Player'} loses!`;
    } else if (round.type === 'TUG_OF_WAR') {
      const duellists = round.duellists || Object.keys(gameState.players);
      const p1 = gameState.players[duellists[0]];
      const p2 = gameState.players[duellists[1]];
      if (p1 && p2) {
        if ((p1.mashCount || 0) < (p2.mashCount || 0)) {
          losers = [p1.id];
          summaryText = `${p2.name} won the mash duel against ${p1.name}!`;
        } else {
          losers = [p2.id];
          summaryText = `${p1.name} won the mash duel against ${p2.name}!`;
        }
      }
    } else if (round.type === 'BOMB_PASS') {
      const loserId = round.bombHolderId || Object.keys(gameState.players)[0];
      losers = [loserId];
      summaryText = `BOOM! The bomb exploded on ${gameState.players[loserId]?.name || 'Player'}!`;
    } else if (round.type === 'TRIVIA') {
      Object.entries(gameState.players).forEach(([pId, p]) => {
        if (p.currentVote !== round.correct) {
          losers.push(pId);
        }
      });
      summaryText = `The correct answer was: ${round.options[round.correct]}!`;
    } else {
      // Default: Pick a random player if unhandled
      const pKeys = Object.keys(gameState.players);
      losers = [pKeys[Math.floor(Math.random() * pKeys.length)]];
      summaryText = 'Fate has chosen the loser!';
    }

    gameState.phase = 'RESULT';
    gameState.activeLosers = losers;

    io.emit('game:round_result', {
      round: gameState.currentRound,
      losers: losers.map(id => gameState.players[id]),
      summaryText,
      availableInventory: getAvailableInventory()
    });
  }

  // HOST: Trigger Wheel Spin
  socket.on('wheel:spin', ({ targetPlayerId }) => {
    const available = getAvailableInventory();
    if (available.length === 0) {
      io.emit('wheel:out_of_drinks', { message: 'All drink inventory is completely EMPTY! Party Legend status unlocked!' });
      return;
    }

    // Safely resolve player ID (whether passed as string or object)
    const pId = typeof targetPlayerId === 'object' ? targetPlayerId?.id : targetPlayerId;
    const player = gameState.players[pId] || Object.values(gameState.players)[0];

    // Pick winning slice based on available stock
    const randomIndex = Math.floor(Math.random() * available.length);
    const chosenDrink = available[randomIndex];

    // Always 1 drink per spin
    const amount = 1;

    // Decrement stock!
    const inventoryItem = gameState.inventory.find(i => i.id === chosenDrink.id);
    if (inventoryItem) {
      inventoryItem.count = Math.max(0, inventoryItem.count - amount);
    }

    // Update player sip counter
    if (player) {
      player.totalSips = (player.totalSips || 0) + amount;
    }

    gameState.lastSpinResult = {
      playerId: player?.id || pId,
      playerName: player?.name || 'Player',
      drink: chosenDrink,
      amount,
      updatedCount: inventoryItem?.count || 0,
      isNowEmpty: inventoryItem?.count === 0
    };

    console.log(`Wheel spin result: ${player?.name} must drink ${amount} ${chosenDrink.unit} of ${chosenDrink.name}. Stock left: ${inventoryItem?.count}, Player total sips: ${player?.totalSips}`);

    // Broadcast updates to all clients (PC & Phones)
    io.emit('wheel:spin_result', {
      spinResult: gameState.lastSpinResult,
      sliceIndex: randomIndex,
      availableInventory: getAvailableInventory(),
      fullInventory: gameState.inventory,
      players: gameState.players
    });

    io.emit('player:update', { players: gameState.players });
    io.emit('inventory:updated', {
      inventory: gameState.inventory,
      availableInventory: getAvailableInventory()
    });
  });

  // ADMIN: Modify Inventory Count Live
  socket.on('admin:update_stock', ({ drinkId, delta, exactCount }) => {
    const drink = gameState.inventory.find(i => i.id === drinkId);
    if (drink) {
      if (typeof exactCount === 'number') {
        drink.count = Math.max(0, exactCount);
      } else if (typeof delta === 'number') {
        drink.count = Math.max(0, drink.count + delta);
      }
      io.emit('inventory:updated', {
        inventory: gameState.inventory,
        availableInventory: getAvailableInventory()
      });
    }
  });

  // ADMIN: Add New Drink Type
  socket.on('admin:add_drink', ({ name, count, unit, color, icon }) => {
    if (!name) return;
    const newDrink = {
      id: `drink_${Date.now()}`,
      name: name.trim(),
      count: Math.max(1, parseInt(count) || 10),
      unit: unit || 'Sip(s)',
      color: color || '#ec4899',
      icon: icon || '🍺'
    };
    gameState.inventory.push(newDrink);
    io.emit('inventory:updated', {
      inventory: gameState.inventory,
      availableInventory: getAvailableInventory()
    });
  });

  // ADMIN: Manual Sip Penalty
  socket.on('admin:give_sip', ({ playerId, amount }) => {
    const p = gameState.players[playerId];
    if (p) {
      p.totalSips += amount || 1;
      io.emit('player:update', { players: gameState.players });
    }
  });

  // ADMIN: Kick Player
  socket.on('admin:kick_player', ({ playerId }) => {
    if (gameState.players[playerId]) {
      delete gameState.players[playerId];
      io.emit('player:update', { players: gameState.players });
    }
  });

  // ADMIN: Reset Game — wipe everything back to SETUP
  socket.on('admin:reset_game', () => {
    console.log('ADMIN: Game reset triggered!');
    gameState.phase = 'SETUP';
    gameState.inventory = [];
    gameState.players = {};
    gameState.roundNumber = 0;
    gameState.currentRound = null;
    gameState.activeLosers = [];
    gameState.lastSpinResult = null;
    gameState.history = [];
    io.emit('state:sync', {
      ...gameState,
      availableInventory: getAvailableInventory()
    });
  });

  // ADMIN: Shutdown Server Process
  socket.on('admin:shutdown', () => {
    console.log('🛑 ADMIN: Shutdown server process command received. Closing...');
    io.emit('server:shutdown', { message: 'Server process closed by host admin.' });
    setTimeout(() => {
      process.exit(0);
    }, 500);
  });

  // Disconnect Handling
  socket.on('disconnect', () => {
    if (gameState.players[socket.id]) {
      console.log(`Player disconnected: ${gameState.players[socket.id].name}`);
      gameState.players[socket.id].connected = false;
      io.emit('player:update', { players: gameState.players });
    }
  });
});

server.listen(PORT, listenHost, () => {
  console.log(`====================================================`);
  if (isTestMode) {
    console.log(`🍻 DRINK BEER PARTY PC APP (LOCALHOST TEST MODE)`);
    console.log(`🖥️ Host Display: http://localhost:${PORT}`);
    console.log(`📱 Test Player:  http://localhost:${PORT}/play`);
  } else {
    console.log(`🍻 DRINK BEER PARTY PC APP (WLAN PARTY MODE)`);
    console.log(`🖥️ Host PC Display: http://localhost:${PORT}`);
    console.log(`📱 Mobile QR Connect (Wi-Fi): ${connectUrl}`);
  }
  console.log(`====================================================`);
});

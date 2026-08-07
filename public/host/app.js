const socket = io();

// STATE OBJECT
let localState = {
  phase: 'SETUP',
  inventory: [],
  availableInventory: [],
  players: {},
  currentRound: null,
  activeLosers: [],
  soundEnabled: true
};

// AUDIO SYNTHESIZER (WEB AUDIO API)
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playSound(type) {
  if (!localState.soundEnabled) return;
  try {
    initAudio();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'click') {
      osc.frequency.setValueAtTime(400, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'spin_tick') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'fanfare') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'buzzer') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'explosion') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.6);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    }
  } catch (err) {
    console.warn('Audio play error:', err);
  }
}

// DOM ELEMENTS
const stages = {
  SETUP: document.getElementById('stage-setup'),
  LOBBY: document.getElementById('stage-lobby'),
  ROUND: document.getElementById('stage-round'),
  RESULT: document.getElementById('stage-result')
};

// ==============================
// DRINK LIBRARY DATABASE
// ==============================
const DRINK_LIBRARY = [
  // Beer
  { id: 'beer_lager',      name: 'Lager',           cat: 'beer',     unit: 'Sip(s)',  color: '#f59e0b', icon: '🍺' },
  { id: 'beer_pils',       name: 'Pilsner',         cat: 'beer',     unit: 'Sip(s)',  color: '#eab308', icon: '🍺' },
  { id: 'beer_wheat',      name: 'Wheat Beer',      cat: 'beer',     unit: 'Sip(s)',  color: '#fbbf24', icon: '🍺' },
  { id: 'beer_ipa',        name: 'IPA',             cat: 'beer',     unit: 'Sip(s)',  color: '#d97706', icon: '🍺' },
  { id: 'beer_stout',      name: 'Stout',           cat: 'beer',     unit: 'Sip(s)',  color: '#92400e', icon: '🍺' },
  { id: 'beer_radler',     name: 'Radler / Shandy', cat: 'beer',     unit: 'Sip(s)',  color: '#fcd34d', icon: '🍋' },
  { id: 'beer_helles',     name: 'Helles',          cat: 'beer',     unit: 'Sip(s)',  color: '#f59e0b', icon: '🍺' },
  { id: 'beer_ale',        name: 'Pale Ale',        cat: 'beer',     unit: 'Sip(s)',  color: '#b45309', icon: '🍺' },
  // Spirits / Shots
  { id: 'shot_vodka',      name: 'Vodka Shot',      cat: 'spirits',  unit: 'Shot(s)', color: '#94a3b8', icon: '🥃' },
  { id: 'shot_tequila',    name: 'Tequila Shot',    cat: 'spirits',  unit: 'Shot(s)', color: '#84cc16', icon: '🥃' },
  { id: 'shot_jager',      name: 'Jägermeister',    cat: 'spirits',  unit: 'Shot(s)', color: '#15803d', icon: '🥃' },
  { id: 'shot_whiskey',    name: 'Whiskey',         cat: 'spirits',  unit: 'Shot(s)', color: '#b45309', icon: '🥃' },
  { id: 'shot_rum',        name: 'Rum',             cat: 'spirits',  unit: 'Shot(s)', color: '#a16207', icon: '🥃' },
  { id: 'shot_sambuca',    name: 'Sambuca',         cat: 'spirits',  unit: 'Shot(s)', color: '#e2e8f0', icon: '🥃' },
  { id: 'shot_gin',        name: 'Gin',             cat: 'spirits',  unit: 'Shot(s)', color: '#06b6d4', icon: '🥃' },
  { id: 'shot_absinthe',   name: 'Absinthe',        cat: 'spirits',  unit: 'Shot(s)', color: '#22c55e', icon: '🧪' },
  { id: 'shot_fireball',   name: 'Fireball',        cat: 'spirits',  unit: 'Shot(s)', color: '#ef4444', icon: '🔥' },
  { id: 'shot_schnapps',   name: 'Schnapps',        cat: 'spirits',  unit: 'Shot(s)', color: '#f472b6', icon: '🥃' },
  // Wine
  { id: 'wine_red',        name: 'Red Wine',        cat: 'wine',     unit: 'Sip(s)',  color: '#881337', icon: '🍷' },
  { id: 'wine_white',      name: 'White Wine',      cat: 'wine',     unit: 'Sip(s)',  color: '#fef08a', icon: '🥂' },
  { id: 'wine_rose',       name: 'Rosé',            cat: 'wine',     unit: 'Sip(s)',  color: '#f9a8d4', icon: '🍷' },
  { id: 'wine_prosecco',   name: 'Prosecco',        cat: 'wine',     unit: 'Sip(s)',  color: '#fde68a', icon: '🥂' },
  { id: 'wine_champagne',  name: 'Champagne',       cat: 'wine',     unit: 'Sip(s)',  color: '#fef9c3', icon: '🍾' },
  // Cocktails
  { id: 'cocktail_mojito',     name: 'Mojito',          cat: 'cocktail', unit: 'Sip(s)',  color: '#10b981', icon: '🍹' },
  { id: 'cocktail_margarita',  name: 'Margarita',       cat: 'cocktail', unit: 'Sip(s)',  color: '#84cc16', icon: '🍹' },
  { id: 'cocktail_longisland', name: 'Long Island',     cat: 'cocktail', unit: 'Sip(s)',  color: '#a16207', icon: '🍹' },
  { id: 'cocktail_aperol',     name: 'Aperol Spritz',   cat: 'cocktail', unit: 'Sip(s)',  color: '#f97316', icon: '🍹' },
  { id: 'cocktail_pina',       name: 'Piña Colada',     cat: 'cocktail', unit: 'Sip(s)',  color: '#fef08a', icon: '🍹' },
  { id: 'cocktail_cuba',       name: 'Cuba Libre',      cat: 'cocktail', unit: 'Sip(s)',  color: '#78350f', icon: '🍹' },
  { id: 'cocktail_mixed',      name: 'Mixed Drink',     cat: 'cocktail', unit: 'Sip(s)',  color: '#ec4899', icon: '🍹' },
  // Soft / Non-Alcoholic
  { id: 'soft_water',      name: 'Water',           cat: 'soft',     unit: 'Gulp(s)', color: '#3b82f6', icon: '💧' },
  { id: 'soft_cola',       name: 'Cola',            cat: 'soft',     unit: 'Sip(s)',  color: '#7c2d12', icon: '🥤' },
  { id: 'soft_juice',      name: 'Juice',           cat: 'soft',     unit: 'Sip(s)',  color: '#f97316', icon: '🧃' },
  { id: 'soft_energy',     name: 'Energy Drink',    cat: 'soft',     unit: 'Sip(s)',  color: '#22d3ee', icon: '⚡' },
  { id: 'soft_soda',       name: 'Soda / Lemonade', cat: 'soft',     unit: 'Sip(s)',  color: '#a3e635', icon: '🍋' },
];

// ==============================
// USER'S ADDED DRINKS (starts empty)
// ==============================
let addedDrinks = []; // Array of { ...libraryItem, count: N }
let activeLibraryCat = 'all';

// Render the user's added drinks on the setup screen
function renderSetupInventory() {
  const container = document.getElementById('inventory-setup-list');
  const emptyMsg = document.getElementById('empty-setup-msg');

  if (addedDrinks.length === 0) {
    container.innerHTML = '';
    container.appendChild(emptyMsg);
    emptyMsg.style.display = 'flex';
    return;
  }

  if (emptyMsg) emptyMsg.style.display = 'none';

  container.innerHTML = addedDrinks.map((item, idx) => `
    <div class="setup-drink-item" data-idx="${idx}" style="border-left: 3px solid ${item.color};">
      <button class="btn-remove-drink" onclick="removeSetupDrink(${idx})" title="Remove">✕</button>
      <div class="drink-title-row">
        <span>${item.icon}</span>
        <span>${item.name}</span>
      </div>
      <span class="drink-unit-label">How many ${item.unit}?</span>
      <input type="number" min="1" value="${item.count}" class="setup-count-input" data-idx="${idx}">
    </div>
  `).join('');

  document.querySelectorAll('.setup-count-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      addedDrinks[idx].count = Math.max(1, parseInt(e.target.value) || 1);
    });
  });
}
renderSetupInventory();

window.removeSetupDrink = function(idx) {
  playSound('click');
  addedDrinks.splice(idx, 1);
  renderSetupInventory();
};

// ==============================
// DRINK LIBRARY MODAL
// ==============================
const libraryModal = document.getElementById('drink-library-modal');
const libraryGrid = document.getElementById('library-grid');

function renderLibrary() {
  const search = (document.getElementById('library-search').value || '').toLowerCase();
  const addedIds = new Set(addedDrinks.map(d => d.id));

  let filtered = DRINK_LIBRARY;
  if (activeLibraryCat !== 'all') {
    filtered = filtered.filter(d => d.cat === activeLibraryCat);
  }
  if (search) {
    filtered = filtered.filter(d => d.name.toLowerCase().includes(search));
  }

  libraryGrid.innerHTML = filtered.map(d => {
    const isAdded = addedIds.has(d.id);
    return `
      <div class="lib-drink-card ${isAdded ? 'already-added' : ''}" data-id="${d.id}" onclick="${isAdded ? '' : `addDrinkFromLibrary('${d.id}')`}">
        <span class="lib-icon">${d.icon}</span>
        <span class="lib-name">${d.name}</span>
        <span class="lib-unit">${d.unit}</span>
        ${isAdded ? '<span class="lib-added-tag">✓ Added</span>' : ''}
      </div>
    `;
  }).join('');
}

window.addDrinkFromLibrary = function(drinkId) {
  const template = DRINK_LIBRARY.find(d => d.id === drinkId);
  if (!template) return;

  playSound('click');
  addedDrinks.push({ ...template, count: 12 });
  renderSetupInventory();
  renderLibrary(); // Update greyed-out states
};

// Open library modal
document.getElementById('btn-open-library').addEventListener('click', () => {
  playSound('click');
  libraryModal.classList.remove('hidden');
  document.getElementById('library-search').value = '';
  activeLibraryCat = 'all';
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.cat-btn[data-cat="all"]').classList.add('active');
  renderLibrary();
  document.getElementById('library-search').focus();
});

// Close library modal
document.getElementById('btn-close-library').addEventListener('click', () => {
  playSound('click');
  libraryModal.classList.add('hidden');
});

// Click outside modal content to close
libraryModal.addEventListener('click', (e) => {
  if (e.target === libraryModal) {
    libraryModal.classList.add('hidden');
  }
});

// Category filter buttons
document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    playSound('click');
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeLibraryCat = btn.dataset.cat;
    renderLibrary();
  });
});

// Search filter
document.getElementById('library-search').addEventListener('input', () => {
  renderLibrary();
});

// Custom drink creator
document.getElementById('btn-add-custom-drink').addEventListener('click', () => {
  const name = prompt('Enter custom drink name:');
  if (!name || !name.trim()) return;
  const unit = prompt('Unit type? (e.g. Sip(s), Shot(s), Gulp(s))', 'Sip(s)') || 'Sip(s)';
  const iconChoice = prompt('Pick an emoji icon:', '🍸') || '🍸';
  const colors = ['#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#ef4444', '#10b981'];

  playSound('click');
  addedDrinks.push({
    id: `custom_${Date.now()}`,
    name: name.trim(),
    cat: 'custom',
    count: 12,
    unit: unit,
    color: colors[addedDrinks.length % colors.length],
    icon: iconChoice
  });
  renderSetupInventory();
  renderLibrary();
});

// SAVE INITIAL INVENTORY & TRANSITION TO LOBBY
document.getElementById('btn-save-inventory').addEventListener('click', () => {
  if (addedDrinks.length === 0) {
    alert('Add at least one drink from the library first!');
    return;
  }
  playSound('click');
  socket.emit('setup:init_inventory', addedDrinks);
});

// STAGE SWITCHER
function switchStage(stageName) {
  Object.keys(stages).forEach(key => {
    if (stages[key]) {
      stages[key].classList.remove('active');
    }
  });
  if (stages[stageName]) {
    stages[stageName].classList.add('active');
  }
}

// FETCH INITIAL INFO (QR CODE & URL) ON LOAD
fetch('/api/info')
  .then(res => res.json())
  .then(info => {
    if (info.url && document.getElementById('lobby-url-display')) {
      document.getElementById('lobby-url-display').textContent = info.url;
    }
    if (info.ip && document.getElementById('nav-ip-url')) {
      document.getElementById('nav-ip-url').textContent = `${info.ip}:${info.port}`;
    }
    if (info.qr && document.getElementById('qr-code-img')) {
      document.getElementById('qr-code-img').src = info.qr;
    }
  })
  .catch(err => console.error('Error fetching server info:', err));

// SOCKET SYNC LISTENER
socket.on('state:sync', (data) => {
  localState = { ...localState, ...data };
  
  if (data.url && document.getElementById('lobby-url-display')) {
    document.getElementById('lobby-url-display').textContent = data.url;
  }
  if (data.ip && document.getElementById('nav-ip-url')) {
    document.getElementById('nav-ip-url').textContent = `${data.ip}:${data.port}`;
  }
  if (data.qr && document.getElementById('qr-code-img')) {
    document.getElementById('qr-code-img').src = data.qr;
  }

  renderLobbyPlayers();
  renderLiveStock();
  renderAdminPanel();

  if (data.phase === 'SETUP') {
    switchStage('SETUP');
    addedDrinks = [];
    renderSetupInventory();
  } else if (data.phase === 'LOBBY') {
    switchStage('LOBBY');
  } else if (data.phase === 'ROUND_ACTIVE') {
    switchStage('ROUND');
    renderRoundCard();
  } else if (data.phase === 'RESULT') {
    switchStage('RESULT');
    renderResultStage();
  }
});

socket.on('player:update', ({ players }) => {
  localState.players = players;
  renderLobbyPlayers();
  renderAdminPanel();
});

socket.on('game:round_started', ({ roundNumber, round, players }) => {
  playSound('click');
  localState.roundNumber = roundNumber;
  localState.currentRound = round;
  localState.players = players;
  switchStage('ROUND');
  renderRoundCard();
});

socket.on('player:vote_updated', ({ playerId, name, hasVoted }) => {
  playSound('click');
  const el = document.getElementById(`voter-${playerId}`);
  if (el) {
    el.classList.add('voted');
    el.textContent = `✓ ${localState.players[playerId]?.name || 'Player'}`;
  }
});

socket.on('game:round_result', ({ round, losers, summaryText, availableInventory }) => {
  playSound('fanfare');
  localState.currentRound = round;
  localState.activeLosers = losers;
  localState.availableInventory = availableInventory;
  
  document.getElementById('result-summary').textContent = summaryText;

  const loser = losers[0] || { name: 'Everyone', avatar: '🤡' };
  document.getElementById('loser-name').textContent = loser.name;
  document.getElementById('loser-avatar').textContent = loser.avatar || '🤡';

  switchStage('RESULT');
  drawWheel();
});

// LOBBY PLAYERS RENDERER
function renderLobbyPlayers() {
  const grid = document.getElementById('players-grid');
  const playersArr = Object.values(localState.players);
  document.getElementById('joined-count').textContent = playersArr.length;

  if (playersArr.length === 0) {
    grid.innerHTML = `
      <div class="empty-lobby">
        <div class="pulse-ring">📱</div>
        <p>Waiting for players to scan QR code & join...</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = playersArr.map(p => `
    <div class="player-card">
      <div class="avatar">${p.avatar || '😎'}</div>
      <div class="name" style="color:${p.color}">${p.name}</div>
      <div class="sip-badge">🍺 ${p.totalSips || 0} Sips</div>
    </div>
  `).join('');
}

// START GAME BUTTON
document.getElementById('btn-start-game').addEventListener('click', () => {
  playSound('click');
  socket.emit('game:start');
});

// ROUND CARD RENDERER
function renderRoundCard() {
  const round = localState.currentRound;
  if (!round) return;

  document.getElementById('round-number-badge').textContent = `ROUND ${localState.roundNumber || 1}`;
  document.getElementById('round-type-badge').textContent = round.title || round.type;
  document.getElementById('round-title').textContent = round.prompt;
  document.getElementById('round-subtitle').textContent = round.sub || '';

  // Render voter pills
  const statusContainer = document.getElementById('voting-status-bar');
  const playersArr = Object.values(localState.players);
  
  statusContainer.innerHTML = playersArr.map(p => `
    <div id="voter-${p.id}" class="voter-pill ${p.currentVote !== null ? 'voted' : ''}">
      ${p.currentVote !== null ? '✓' : '⏳'} ${p.name}
    </div>
  `).join('');
}

// REVEAL RESULTS BUTTON
document.getElementById('btn-eval-round').addEventListener('click', () => {
  playSound('click');
  socket.emit('game:eval_round');
});

// LIVE STOCK RENDERER
function renderLiveStock() {
  const container = document.getElementById('live-stock-list');
  const items = localState.inventory || [];
  
  container.innerHTML = items.map(item => `
    <div class="stock-item ${item.count === 0 ? 'empty' : ''}">
      <div style="display:flex; align-items:center; gap:8px;">
        <span>${item.icon}</span>
        <span style="font-weight:700;">${item.name}</span>
      </div>
      <div class="count-badge" style="background:${item.color}20; color:${item.color}; border:1px solid ${item.color};">
        ${item.count} ${item.unit}
      </div>
    </div>
  `).join('');
}

// LISTEN FOR LIVE INVENTORY UPDATES
socket.on('inventory:updated', ({ inventory, availableInventory }) => {
  localState.inventory = inventory;
  localState.availableInventory = availableInventory;
  renderLiveStock();
  renderAdminPanel();
  if (!isSpinning) {
    drawWheel();
  }
});

// CANVAS WHEEL RENDERER & SPIN PHYSICS
const canvas = document.getElementById('wheel-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
let currentRotation = 0;
let isSpinning = false;

function drawWheel(itemsOverride) {
  if (!ctx) return;
  const items = itemsOverride || localState.availableInventory || [];
  const totalSlices = items.length;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (totalSlices === 0) {
    // Empty wheel warning!
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 24px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText('OUT OF DRINKS!', canvas.width / 2, canvas.height / 2);
    return;
  }

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = canvas.width / 2 - 10;
  const sliceAngle = (2 * Math.PI) / totalSlices;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(currentRotation);

  for (let i = 0; i < totalSlices; i++) {
    const startAngle = i * sliceAngle;
    const endAngle = (i + 1) * sliceAngle;
    const item = items[i];

    // Slice background
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#090d16';
    ctx.stroke();

    // Slice Text & Icon
    ctx.save();
    ctx.rotate(startAngle + sliceAngle / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Outfit';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(`${item.icon} ${item.name} (${item.count})`, radius - 30, 8);
    ctx.restore();
  }

  // Center Knob
  ctx.beginPath();
  ctx.arc(0, 0, 45, 0, 2 * Math.PI);
  ctx.fillStyle = '#090d16';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#f59e0b';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Outfit';
  ctx.textAlign = 'center';
  ctx.fillText('DRINK', 0, 6);

  ctx.restore();
}

// SPIN WHEEL BUTTON
const btnSpin = document.getElementById('btn-spin-wheel');
if (btnSpin) {
  btnSpin.addEventListener('click', () => {
    if (isSpinning) return;
    const targetPlayer = localState.activeLosers[0] || Object.keys(localState.players)[0];
    if (targetPlayer) {
      playSound('click');
      const targetId = typeof targetPlayer === 'object' ? targetPlayer.id : targetPlayer;
      socket.emit('wheel:spin', { targetPlayerId: targetId });
    }
  });
}

// LISTEN FOR SPIN RESULT FROM SERVER
socket.on('wheel:spin_result', ({ spinResult, sliceIndex, availableInventory, fullInventory, players }) => {
  // Use current pre-spin inventory layout for physics angle calculation
  const spinItems = [...(localState.availableInventory || [])];
  const totalSlices = spinItems.length || 1;
  const sliceAngle = (2 * Math.PI) / totalSlices;
  
  // The pointer is at top (-Math.PI / 2).
  const targetSliceAngle = (sliceIndex * sliceAngle) + (sliceAngle / 2);
  const targetRotation = (2 * Math.PI * 5) - targetSliceAngle - (Math.PI / 2);

  animateWheelSpin(targetRotation, spinItems, () => {
    // Sync state after spin animation finishes
    localState.inventory = fullInventory;
    localState.availableInventory = availableInventory;
    localState.players = players;
    renderLiveStock();
    renderAdminPanel();
    drawWheel();

    // Show spin result popup
    playSound('fanfare');
    document.getElementById('spin-drink-icon').textContent = spinResult.drink.icon;
    document.getElementById('spin-result-text').textContent = `${spinResult.playerName}: ${spinResult.amount} ${spinResult.drink.name}!`;
    document.getElementById('spin-stock-update').textContent = spinResult.isNowEmpty ? `⚠️ ${spinResult.drink.name} is now OUT OF STOCK!` : `${spinResult.updatedCount} ${spinResult.drink.name} left`;

    document.getElementById('spin-result-card').classList.remove('hidden');
  });
});

function animateWheelSpin(targetAngle, spinItems, onComplete) {
  isSpinning = true;
  const startAngle = currentRotation;
  const duration = 4000;
  const startTime = performance.now();
  let lastTickAngle = currentRotation;

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    
    // Ease out cubic
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    currentRotation = startAngle + (targetAngle - startAngle) * easeProgress;

    // Trigger tick sound on slice crossing
    if (Math.abs(currentRotation - lastTickAngle) > 0.3) {
      playSound('spin_tick');
      lastTickAngle = currentRotation;
    }

    drawWheel(spinItems);

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      isSpinning = false;
      if (onComplete) onComplete();
    }
  }
  requestAnimationFrame(step);
}

// CONTINUE GAME TO NEXT ROUND
document.getElementById('btn-continue-game').addEventListener('click', () => {
  playSound('click');
  document.getElementById('spin-result-card').classList.add('hidden');
  socket.emit('game:next_round');
});

// ADMIN PANEL LOGIC
const adminDrawer = document.getElementById('admin-drawer');
document.getElementById('btn-admin-toggle').addEventListener('click', () => {
  playSound('click');
  adminDrawer.classList.toggle('open');
  renderAdminPanel();
});
document.getElementById('btn-close-admin').addEventListener('click', () => {
  playSound('click');
  adminDrawer.classList.remove('open');
});

function renderAdminPanel() {
  const container = document.getElementById('admin-stock-grid');
  if (!container) return;

  const items = localState.inventory || [];
  container.innerHTML = items.map(item => `
    <div class="admin-stock-row">
      <div>
        <span>${item.icon} ${item.name}</span>
      </div>
      <div class="stock-controls">
        <button class="btn-ctrl" onclick="updateStock('${item.id}', -1)">-</button>
        <span style="font-weight:800; min-width:30px; text-align:center;">${item.count}</span>
        <button class="btn-ctrl" onclick="updateStock('${item.id}', 1)">+</button>
      </div>
    </div>
  `).join('');

  // Admin Players list
  const playersContainer = document.getElementById('admin-players-list');
  if (playersContainer) {
    const pArr = Object.values(localState.players || {});
    playersContainer.innerHTML = pArr.map(p => `
      <div class="admin-stock-row" style="margin-bottom:8px;">
        <span>${p.avatar} ${p.name} (${p.totalSips} Sips)</span>
        <div style="display:flex; gap:6px;">
          <button class="btn-warning" onclick="giveSip('${p.id}')">+1 Sip</button>
          <button class="btn-danger" onclick="kickPlayer('${p.id}')">Kick</button>
        </div>
      </div>
    `).join('');
  }
}

window.updateStock = function(drinkId, delta) {
  playSound('click');
  socket.emit('admin:update_stock', { drinkId, delta });
};

window.giveSip = function(playerId) {
  playSound('click');
  socket.emit('admin:give_sip', { playerId, amount: 1 });
};

window.kickPlayer = function(playerId) {
  playSound('click');
  socket.emit('admin:kick_player', { playerId });
};

document.getElementById('btn-admin-add-drink').addEventListener('click', () => {
  const name = document.getElementById('admin-new-name').value;
  const count = document.getElementById('admin-new-count').value;
  const unit = document.getElementById('admin-new-unit').value;

  if (name) {
    playSound('click');
    socket.emit('admin:add_drink', { name, count, unit });
    document.getElementById('admin-new-name').value = '';
  }
});

document.getElementById('btn-admin-skip-round').addEventListener('click', () => {
  playSound('click');
  socket.emit('game:next_round');
});

// ADMIN: Force Wheel Spin — picks a random player and triggers spin
document.getElementById('btn-admin-force-spin').addEventListener('click', () => {
  playSound('click');
  const playerKeys = Object.keys(localState.players);
  if (playerKeys.length === 0) {
    alert('No players connected!');
    return;
  }
  const randomPlayer = playerKeys[Math.floor(Math.random() * playerKeys.length)];
  // Switch to result view with that player as loser, then spin
  localState.activeLosers = [localState.players[randomPlayer]];
  document.getElementById('result-summary').textContent = `Admin forced a wheel spin!`;
  document.getElementById('loser-name').textContent = localState.players[randomPlayer].name;
  document.getElementById('loser-avatar').textContent = localState.players[randomPlayer].avatar || '🎯';
  localState.availableInventory = (localState.inventory || []).filter(i => i.count > 0);
  switchStage('RESULT');
  drawWheel();
  // Auto-spin after a brief moment
  setTimeout(() => {
    socket.emit('wheel:spin', { targetPlayerId: randomPlayer });
  }, 500);
});

// ADMIN: Reset Game — go back to setup
document.getElementById('btn-admin-reset').addEventListener('click', () => {
  if (!confirm('Reset the entire game? All progress will be lost!')) return;
  playSound('click');
  socket.emit('admin:reset_game');
});

// ADMIN: Close App / Shutdown Server
const btnShutdown = document.getElementById('btn-admin-shutdown');
if (btnShutdown) {
  btnShutdown.addEventListener('click', () => {
    if (!confirm('Close all processes and shut down the server?')) return;
    playSound('click');
    socket.emit('admin:shutdown');
  });
}

socket.on('server:shutdown', ({ message }) => {
  document.body.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; text-align:center; color:#ef4444; font-family:'Outfit',sans-serif; background:#090d16; padding:32px;">
      <div style="font-size:72px; margin-bottom:16px;">🛑</div>
      <h1 style="font-size:40px; font-weight:900; margin-bottom:12px;">Server Process Closed</h1>
      <p style="font-size:18px; color:#94a3b8; max-width:500px;">${message || 'The host admin closed the application server.'}</p>
    </div>
  `;
});

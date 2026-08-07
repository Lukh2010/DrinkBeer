const socket = io();

let myPlayer = {
  id: null,
  name: '',
  avatar: '😎',
  totalSips: 0
};

let currentRound = null;
let buzzerStartTime = 0;

// DOM Screens
const screens = {
  JOIN: document.getElementById('screen-join'),
  WAITING: document.getElementById('screen-waiting'),
  VOTING: document.getElementById('screen-voting'),
  BUZZER: document.getElementById('screen-buzzer'),
  MASH: document.getElementById('screen-mash'),
  BOMB: document.getElementById('screen-bomb')
};

function showScreen(screenName) {
  Object.keys(screens).forEach(key => {
    if (screens[key]) {
      screens[key].classList.remove('active');
    }
  });
  if (screens[screenName]) {
    screens[screenName].classList.add('active');
  }
}

// AVATAR PICKER LOGIC
document.querySelectorAll('.avatar-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.avatar-opt').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    myPlayer.avatar = btn.dataset.avatar;
  });
});

// FORM JOIN SUBMIT
document.getElementById('form-join').addEventListener('submit', (e) => {
  e.preventDefault();
  const nameInput = document.getElementById('input-name').value;
  if (!nameInput) return;

  myPlayer.name = nameInput.trim();
  socket.emit('player:join', { name: myPlayer.name, avatar: myPlayer.avatar });

  document.getElementById('player-name-display').textContent = myPlayer.name;
  document.getElementById('player-avatar-badge').textContent = myPlayer.avatar;

  showScreen('WAITING');
});

// SOCKET EVENTS FROM SERVER
socket.on('state:sync', (state) => {
  if (state.players && socket.id && state.players[socket.id]) {
    myPlayer.totalSips = state.players[socket.id].totalSips || 0;
    document.getElementById('player-sip-count').textContent = myPlayer.totalSips;
  }
});

socket.on('game:round_started', ({ roundNumber, round, players }) => {
  currentRound = round;
  
  if (players && socket.id && players[socket.id]) {
    myPlayer.totalSips = players[socket.id].totalSips || 0;
    document.getElementById('player-sip-count').textContent = myPlayer.totalSips;
  }

  // Determine view based on round type
  if (round.type === 'MOST_LIKELY') {
    renderVotingOptions(Object.values(players));
    showScreen('VOTING');
  } else if (round.type === 'NEVER_EVER') {
    renderNeverEverOptions();
    showScreen('VOTING');
  } else if (round.type === 'SPEED_BUZZER') {
    setupSpeedBuzzer();
    showScreen('BUZZER');
  } else if (round.type === 'TUG_OF_WAR') {
    setupMashPad();
    showScreen('MASH');
  } else if (round.type === 'BOMB_PASS') {
    setupBombPass(players);
    showScreen('BOMB');
  } else if (round.type === 'TRIVIA') {
    renderTriviaOptions(round);
    showScreen('VOTING');
  } else {
    showScreen('WAITING');
  }
});

socket.on('game:round_result', () => {
  showScreen('WAITING');
});

// VOTING CONTROLLER
function renderVotingOptions(playersArr) {
  document.getElementById('ctrl-prompt-badge').textContent = 'MOST LIKELY TO';
  document.getElementById('ctrl-prompt-title').textContent = currentRound.prompt;
  document.getElementById('voted-confirmation').classList.add('hidden');

  const container = document.getElementById('voting-options-container');
  container.classList.remove('hidden');

  container.innerHTML = playersArr.map(p => `
    <button class="btn-vote-opt" onclick="submitVote('${p.id}')">
      <span>${p.avatar}</span>
      <span>${p.name}</span>
    </button>
  `).join('');
}

function renderNeverEverOptions() {
  document.getElementById('ctrl-prompt-badge').textContent = 'NEVER HAVE I EVER';
  document.getElementById('ctrl-prompt-title').textContent = currentRound.prompt;
  document.getElementById('voted-confirmation').classList.add('hidden');

  const container = document.getElementById('voting-options-container');
  container.classList.remove('hidden');

  container.innerHTML = `
    <button class="btn-vote-opt" style="border-color:#ef4444;" onclick="submitVote('HAVE')">
      <span>🙋‍♂️</span>
      <span>I HAVE DONE THIS</span>
    </button>
    <button class="btn-vote-opt" style="border-color:#10b981;" onclick="submitVote('NEVER')">
      <span>😇</span>
      <span>NEVER HAVE I EVER</span>
    </button>
  `;
}

function renderTriviaOptions(round) {
  document.getElementById('ctrl-prompt-badge').textContent = 'SPEED TRIVIA';
  document.getElementById('ctrl-prompt-title').textContent = round.prompt;
  document.getElementById('voted-confirmation').classList.add('hidden');

  const container = document.getElementById('voting-options-container');
  container.classList.remove('hidden');

  container.innerHTML = (round.options || []).map((opt, idx) => `
    <button class="btn-vote-opt" onclick="submitVote(${idx})">
      <span>${['A', 'B', 'C', 'D'][idx]}</span>
      <span>${opt}</span>
    </button>
  `).join('');
}

window.submitVote = function(voteValue) {
  if (navigator.vibrate) navigator.vibrate(50);
  socket.emit('player:submit_vote', { vote: voteValue });

  document.getElementById('voting-options-container').classList.add('hidden');
  document.getElementById('voted-confirmation').classList.remove('hidden');
};

// SPEED BUZZER CONTROLLER
function setupSpeedBuzzer() {
  const statusEl = document.getElementById('buzzer-status');
  const btn = document.getElementById('btn-speed-buzzer');
  
  statusEl.textContent = 'WAIT FOR GREEN...';
  statusEl.style.color = '#ef4444';
  btn.classList.remove('active');
  btn.disabled = true;

  // Random countdown before turning green (2 to 5 seconds)
  const delay = Math.floor(Math.random() * 3000) + 2000;
  setTimeout(() => {
    statusEl.textContent = 'GO! TAP BUZZER NOW!';
    statusEl.style.color = '#10b981';
    btn.classList.add('active');
    btn.disabled = false;
    buzzerStartTime = performance.now();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  }, delay);
}

document.getElementById('btn-speed-buzzer').addEventListener('click', () => {
  const timeMs = Math.round(performance.now() - buzzerStartTime);
  if (navigator.vibrate) navigator.vibrate(80);

  socket.emit('player:buzzer_press', { timeMs });

  const statusEl = document.getElementById('buzzer-status');
  statusEl.textContent = `BUZZED IN: ${timeMs}ms!`;
  document.getElementById('btn-speed-buzzer').disabled = true;
  document.getElementById('btn-speed-buzzer').classList.remove('active');
});

// BUTTON MASH CONTROLLER
let localMashCount = 0;
function setupMashPad() {
  localMashCount = 0;
  document.getElementById('mash-count-badge').textContent = '0';
}

document.getElementById('btn-mash-pad').addEventListener('click', () => {
  localMashCount++;
  document.getElementById('mash-count-badge').textContent = localMashCount;
  if (navigator.vibrate) navigator.vibrate(30);

  socket.emit('player:mash_tap');
});

// BOMB PASS CONTROLLER
function setupBombPass(playersObj) {
  const container = document.getElementById('bomb-pass-players');
  const otherPlayers = Object.values(playersObj).filter(p => p.id !== socket.id);

  container.innerHTML = otherPlayers.map(p => `
    <button class="btn-pass-target" onclick="passBomb('${p.id}')">
      Pass Bomb to ${p.avatar} ${p.name}
    </button>
  `).join('');
}

window.passBomb = function(targetId) {
  if (navigator.vibrate) navigator.vibrate(100);
  socket.emit('player:pass_bomb', { targetPlayerId: targetId });
  showScreen('WAITING');
};

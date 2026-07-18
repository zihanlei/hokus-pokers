const socket = io();
let currentRoom = null;
let mySocketId = null;
let isSpectator = false;
let soundEnabled = true;
let audioCtx = null;
let timerInterval = null;
let nextHandInterval = null;
let hasRequestedJoin = false;
let rebuyPending = false;
let lastRequestCount = 0; // for notification sound

// -------------------------
// SECURITY: HTML escaping to prevent XSS
// -------------------------
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// -------------------------
// CARD DISPLAY HELPERS
// -------------------------
function displayRank(r) {
  return r === 'T' ? '10' : r;
}
const SUIT_SYMBOLS = { 's': '♠', 'h': '♥', 'd': '♦', 'c': '♣' };
const RED_SUITS = { 'h': true, 'd': true };

// -------------------------
// AUDIO MANAGER
// -------------------------
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playSound(type) {
  if (!soundEnabled) return;
  initAudio();
  const ctx = audioCtx;
  const now = ctx.currentTime;
  const createOsc = (freq, dur, type='sine', vol=0.1) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  };
  switch(type) {
    case 'click': createOsc(800, 0.05, 'square', 0.05); break;
    case 'deal': createOsc(400, 0.1, 'sine', 0.05); break;
    case 'fold': createOsc(200, 0.15, 'sawtooth', 0.05); break;
    case 'win':
      [523, 659, 784].forEach((f, i) => setTimeout(() => createOsc(f, 0.2, 'sine', 0.1), i * 100));
      break;
    case 'tick': createOsc(1000, 0.03, 'square', 0.03); break;
    case 'turn': createOsc(600, 0.1, 'sine', 0.08); setTimeout(() => createOsc(800, 0.1, 'sine', 0.08), 100); break;
    case 'notification':
      [440, 554, 659].forEach((f, i) => setTimeout(() => createOsc(f, 0.15, 'sine', 0.12), i * 80));
      break;
  }
}

// -------------------------
// NOTIFICATION BADGE
// -------------------------
function updateNotificationBadge() {
  if (!currentRoom) return;
  const badge = document.getElementById('settings-badge');
  if (!badge) return;
  const isHost = currentRoom.hostId === mySocketId;
  if (!isHost) {
    badge.classList.remove('show');
    return;
  }
  const rebuyCount = (currentRoom.rebuyRequests || []).length;
  const joinCount = (currentRoom.joinRequests || []).filter(r => !r.approved).length;
  const totalCount = rebuyCount + joinCount;
  if (totalCount > lastRequestCount && totalCount > 0) {
    playSound('notification');
  }
  lastRequestCount = totalCount;
  if (totalCount > 0) {
    badge.classList.add('show');
    badge.innerText = totalCount;
  } else {
    badge.classList.remove('show');
  }
}

// -------------------------
// SCREEN MANAGEMENT
// -------------------------
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'screen-join') {
    socket.emit('list-public-rooms');
  }
}

// -------------------------
// LOBBY LOGIC
// -------------------------
function createRoom() {
  const nickname = document.getElementById('host-nickname').value.trim();
  if (!nickname) return alert('Enter a nickname');

  const maxPlayersRaw = parseInt(document.getElementById('host-max').value);
  if (!maxPlayersRaw || maxPlayersRaw < 2) return alert('Max players must be at least 2');
  if (maxPlayersRaw > 12) return alert('Maximum is 12 players. Please enter a number between 2 and 12.');

  socket.emit('create-room', {
    nickname,
    roomName: document.getElementById('host-roomname').value.trim() || nickname,
    password: document.getElementById('host-password').value,
    smallBlind: parseInt(document.getElementById('host-sb').value),
    bigBlind: parseInt(document.getElementById('host-bb').value),
    maxPlayers: maxPlayersRaw,
    startingChips: parseInt(document.getElementById('host-chips').value),
    rebuysAllowed: document.getElementById('host-rebuys').checked,
    timerEnabled: document.getElementById('host-timer').checked,
    timerSeconds: parseInt(document.getElementById('host-timer-duration').value) || 20
  });
}

function openJoinModal(code) {
  document.getElementById('join-modal-code').value = code || '';
  document.getElementById('join-modal-nickname').value = '';
  document.getElementById('join-modal-password').value = '';
  document.getElementById('join-modal').classList.add('show');
  setTimeout(() => {
    if (code) document.getElementById('join-modal-nickname').focus();
    else document.getElementById('join-modal-code').focus();
  }, 100);
}

function closeJoinModal() {
  document.getElementById('join-modal').classList.remove('show');
}

function joinRoomFromModal() {
  const code = document.getElementById('join-modal-code').value.trim().toUpperCase();
  const nickname = document.getElementById('join-modal-nickname').value.trim();
  const password = document.getElementById('join-modal-password').value;
  if (!nickname) return alert('Enter a nickname');
  if (!code) return alert('Enter a room code');
  socket.emit('join-room', { roomCode: code, nickname, password });
  closeJoinModal();
}

function spectateFromModal() {
  const code = document.getElementById('join-modal-code').value.trim().toUpperCase();
  const nickname = document.getElementById('join-modal-nickname').value.trim();
  const password = document.getElementById('join-modal-password').value;
  if (!nickname) return alert('Enter a nickname');
  if (!code) return alert('Enter a room code');
  socket.emit('spectate-room', { roomCode: code, nickname, password });
  closeJoinModal();
}

socket.on('public-rooms', (rooms) => {
  const list = document.getElementById('public-rooms-list');
  list.innerHTML = '';
  if (!rooms || rooms.length === 0) {
    list.innerHTML = '<p class="no-rooms">No rooms available.<br>Create one!</p>';
    return;
  }
  rooms.forEach(r => {
    const div = document.createElement('div');
    div.className = 'room-item';
    const lockIcon = r.hasPassword ? ' [Private]' : '';
    const statusText = r.isPlaying ? ' (In Progress)' : '';
    const fullText = r.playerCount >= r.maxPlayers ? ' (Full)' : '';
    div.innerHTML = `
      <div class="room-info-item">
        <b>${r.name}${lockIcon}</b><br>
        <small>${r.playerCount}/${r.maxPlayers} players${statusText}${fullText}</small>
      </div>
      <button class="btn btn-tiny btn-primary">Join</button>
    `;
    const openModal = (e) => {
      e.stopPropagation();
      openJoinModal(r.id);
    };
    div.querySelector('button').addEventListener('click', openModal);
    div.addEventListener('click', openModal);
    list.appendChild(div);
  });
});

// -------------------------
// ROOM EVENTS
// -------------------------
socket.on('joined-room', (state) => {
  currentRoom = state;
  mySocketId = socket.id;
  showScreen('screen-game');
  renderTable();
  document.getElementById('room-code-display').innerText = `Room: ${state.id}`;
  document.getElementById('host-display').innerText = `| Host: ${state.players.find(p => p.id === state.hostId)?.name || 'N/A'}`;
  updateHostUI();
  updateSpectatorUI();
});

socket.on('set-spectator', (val) => {
  isSpectator = val;
  updateSpectatorUI();
});

socket.on('joined-as-player', () => {
  isSpectator = false;
  hasRequestedJoin = false;
  updateSpectatorUI();
});

socket.on('join-requested', (val) => {
  hasRequestedJoin = val;
  updateSpectatorUI();
});

socket.on('join-status', (data) => {
  if (data.status === 'approved') {
    alert('Your join request has been approved! You will join at the start of the next hand.');
  } else if (data.status === 'declined') {
    alert('Your join request has been declined.');
    hasRequestedJoin = false;
    updateSpectatorUI();
  }
});

socket.on('rebuy-pending', (val) => {
  rebuyPending = val;
  updateSpectatorUI();
});

socket.on('rebuy-result', (data) => {
  rebuyPending = false;
  if (data.approved) {
    alert(`Rebuy approved for $${data.amount}! You will join the next hand.`);
  } else {
    alert('Rebuy request declined.');
  }
  updateSpectatorUI();
});

socket.on('game-ended', () => {
  alert('The host has ended the game.');
  socket.disconnect();
  location.reload();
});

socket.on('error-msg', (msg) => alert(msg));

socket.on('state-update', (state) => {
  currentRoom = state;
  renderTable();
  // Update host display in top bar (in case host changed due to disconnect)
  const hostPlayer = state.players.find(p => p.id === state.hostId);
  document.getElementById('host-display').innerText = `| Host: ${hostPlayer?.name || 'N/A'}`;
  // If we're between hands (showdown), refresh the next-hand overlay
  // so the START NEXT HAND button updates when rebuys are approved or joins accepted
  if (state.gameState.status === 'playing' && state.gameState.bettingRound === 'showdown') {
    showNextHandOverlay();
  }
  if (document.getElementById('settings-modal').classList.contains('show')) {
    updateSettingsUI();
  }
  updateHostUI();
  updateSpectatorUI();
});

socket.on('hand-started', (state) => {
  currentRoom = state;
  renderTable();
  playSound('deal');
  document.getElementById('next-hand-overlay').classList.add('hidden');
  if (nextHandInterval) { clearInterval(nextHandInterval); nextHandInterval = null; }
});

socket.on('hand-ended', (data) => {
  currentRoom = data.state;
  renderTable();
  if (data.results.some(r => r.playerId === mySocketId)) playSound('win');
  else playSound('fold');
  const banner = document.getElementById('win-banner');
  if (banner) {
    const winText = data.results.map(r => {
      const p = currentRoom.players.find(pl => pl.id === r.playerId);
      return `${escapeHtml(p?.name)} won $${r.amount} (${escapeHtml(r.hand)})`;
    }).join('  -  ');
    banner.innerText = winText;
    banner.classList.add('show');
    clearTimeout(banner._timer);
    banner._timer = setTimeout(() => {
      banner.classList.remove('show');
      banner.innerText = '';
    }, 5000);
  }
  showNextHandOverlay();
});

socket.on('turn-timer', (data) => {
  if (data.playerId === mySocketId && data.endTime > 0) playSound('turn');
  startTimerCountdown(data.endTime);
});

socket.on('chat-message', (msg) => {
  const div = document.getElementById('chat-messages');
  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-msg' + (msg.isSpectator ? ' spectator' : '');
  msgDiv.innerHTML = `<b>${escapeHtml(msg.sender)}:</b> ${escapeHtml(msg.message)}`;
  div.appendChild(msgDiv);
  div.scrollTop = div.scrollHeight;
});

socket.on('emoji-received', (data) => {
  const seat = document.querySelector(`.seat[data-seat="${data.seatIndex}"]`);
  if (seat) {
    const emoji = document.createElement('div');
    emoji.className = 'floating-emoji';
    emoji.innerText = data.emoji;
    emoji.style.left = '50%';
    emoji.style.top = '0';
    seat.appendChild(emoji);
    setTimeout(() => emoji.remove(), 2000);
  }
});

socket.on('kicked', (data) => {
  if (data && data.toSpectator) {
    // Kicked from player to spectator — stay in the room as a spectator
    alert('You have been moved to spectators by the host.');
    isSpectator = true;
    hasRequestedJoin = false;
    rebuyPending = false;
    updateSpectatorUI();
  } else {
    // Kicked from the room entirely
    alert('You have been removed from the room by the host.');
    showScreen('screen-home');
  }
});

// -------------------------
// TIMER COUNTDOWN
// -------------------------
function startTimerCountdown(endTime) {
  const bar = document.getElementById('timer-bar');
  const text = document.getElementById('timer-text');
  const container = document.getElementById('timer-bar-container');
  if (!endTime || endTime === 0) {
    container.style.display = 'none';
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    return;
  }
  container.style.display = 'block';
  if (timerInterval) clearInterval(timerInterval);
  const update = () => {
    const timeLeft = Math.max(0, (endTime - Date.now()) / 1000);
    const totalDuration = currentRoom?.settings?.timerSeconds || 20;
    const pct = (timeLeft / totalDuration) * 100;
    bar.style.width = pct + '%';
    text.innerText = Math.ceil(timeLeft) + 's';
    if (timeLeft < 5) {
      bar.style.background = 'var(--btn-danger)';
      if (timeLeft > 0 && Math.floor(timeLeft) !== Math.floor(timeLeft + 0.1)) {
        playSound('tick');
      }
    } else {
      bar.style.background = 'var(--btn-secondary)';
    }
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      container.style.display = 'none';
    }
  };
  update();
  timerInterval = setInterval(update, 100);
}

// -------------------------
// NEXT HAND OVERLAY
// -------------------------
function showNextHandOverlay() {
  const overlay = document.getElementById('next-hand-overlay');
  const btn = document.getElementById('btn-next-hand');
  const countdown = document.getElementById('next-hand-countdown');
  const status = document.getElementById('next-hand-status');
  const isHost = currentRoom?.hostId === mySocketId;
  overlay.classList.remove('hidden');
  // Count players who WILL be active next hand:
  // - players with chips > 0 who aren't sitting out
  // - players who have rebought (will be activated at hand start)
  const activePlayers = currentRoom?.players.filter(p => {
    if (p.hasRebought) return true;
    return !p.isSittingOut && p.chips > 0;
  }) || [];
  // Add approved spectators (in joinQueue) to the count — they'll be seated next hand
  const approvedSpectators = (currentRoom?.spectators || []).filter(s => s.joinApproved).length;
  const totalPotential = activePlayers.length + approvedSpectators;

  if (isHost) {
    if (totalPotential >= 2) {
      btn.style.display = 'inline-block';
      btn.disabled = false;
      status.innerText = 'Hand complete!';
      countdown.innerText = 'Click to start the next hand.';
    } else {
      btn.style.display = 'none';
      status.innerText = 'Need 2+ active players';
      countdown.innerText = 'Waiting for players to rebuy or join...';
    }
  } else {
    btn.style.display = 'none';
    if (totalPotential >= 2) {
      status.innerText = 'Hand complete!';
      countdown.innerText = 'Waiting for host to start next hand...';
    } else {
      status.innerText = 'Waiting for more players';
      countdown.innerText = 'Waiting for players to rebuy or join...';
    }
  }
}

// -------------------------
// HOST UI HELPERS
// -------------------------
function updateHostUI() {
  if (!currentRoom) return;
  const isHost = currentRoom.hostId === mySocketId;
  document.getElementById('host-settings-btn').style.display = isHost ? 'block' : 'none';
  const rebuysStatus = document.getElementById('rebuys-status');
  if (rebuysStatus) {
    rebuysStatus.innerText = currentRoom.settings.rebuysAllowed ? 'Allowed (ON)' : 'Disabled (OFF)';
  }
  updateNotificationBadge();
}

// -------------------------
// SPECTATOR UI
// -------------------------
function updateSpectatorUI() {
  const area = document.getElementById('spectator-join-area');
  const btnJoin = document.getElementById('btn-request-join');
  const btnCancel = document.getElementById('btn-cancel-join');
  const rebuyArea = document.getElementById('rebuy-area');
  const rebuyPendingArea = document.getElementById('rebuy-pending-area');
  const rebuyBtn = rebuyArea.querySelector('button');
  const chatInputRow = document.getElementById('chat-input-row');
  const chatNotice = document.getElementById('chat-spectator-notice');

  if (isSpectator) {
    area.style.display = 'block';
    rebuyArea.style.display = 'none';
    rebuyPendingArea.style.display = 'none';
    // Hide chat input + emoji — spectators can't chat or react
    if (chatInputRow) chatInputRow.style.display = 'none';
    if (chatNotice) chatNotice.style.display = 'block';
    if (hasRequestedJoin) {
      btnJoin.style.display = 'none';
      btnCancel.style.display = 'block';
    } else {
      btnJoin.style.display = 'block';
      btnCancel.style.display = 'none';
    }
  } else {
    area.style.display = 'none';
    // Show chat input + emoji for players
    if (chatInputRow) chatInputRow.style.display = 'flex';
    if (chatNotice) chatNotice.style.display = 'none';
    const me = currentRoom?.players.find(p => p.id === mySocketId);
    const isHost = currentRoom?.hostId === mySocketId;
    if (me && me.chips === 0 && currentRoom.settings.rebuysAllowed && !rebuyPending) {
      rebuyArea.style.display = 'block';
      rebuyPendingArea.style.display = 'none';
      if (rebuyBtn) {
        rebuyBtn.innerText = isHost ? 'Rebuy Now' : 'Request Rebuy';
      }
    } else if (me && me.chips === 0 && rebuyPending) {
      rebuyArea.style.display = 'none';
      rebuyPendingArea.style.display = 'block';
    } else {
      rebuyArea.style.display = 'none';
      rebuyPendingArea.style.display = 'none';
    }
  }
}

function requestJoin() {
  socket.emit('request-join');
}

function cancelJoin() {
  socket.emit('cancel-join');
}

// REBUY flow
function openRebuyModal() {
  const isHost = currentRoom?.hostId === mySocketId;
  const defaultAmount = currentRoom?.settings?.startingChips || 1000;
  document.getElementById('rebuy-modal-amount').value = defaultAmount;
  const desc = document.getElementById('rebuy-modal-desc');
  const submitBtn = document.getElementById('rebuy-modal-submit');
  if (isHost) {
    desc.innerText = 'Enter the amount you want to rebuy for. As host, your rebuy is instant (no approval needed). You will join the next hand.';
    submitBtn.innerText = 'Rebuy Now';
  } else {
    desc.innerText = 'Enter the amount you want to rebuy for. The host will need to approve this request.';
    submitBtn.innerText = 'Send Request';
  }
  document.getElementById('rebuy-modal').classList.add('show');
  setTimeout(() => document.getElementById('rebuy-modal-amount').focus(), 100);
}

function closeRebuyModal() {
  document.getElementById('rebuy-modal').classList.remove('show');
}

function sendRebuyRequest() {
  const amount = parseInt(document.getElementById('rebuy-modal-amount').value);
  if (!amount || amount < 1) return alert('Enter a valid amount');
  const isHost = currentRoom?.hostId === mySocketId;
  if (isHost) {
    socket.emit('host-rebuy', { amount });
  } else {
    socket.emit('rebuy-request', { amount });
  }
  closeRebuyModal();
}

function cancelRebuyRequest() {
  socket.emit('cancel-rebuy');
}

// HOST actions for rebuy/join requests
function approveRebuy(playerId, amount) {
  const numAmount = parseInt(amount);
  if (!numAmount || numAmount < 1) return alert('Invalid amount');
  socket.emit('approve-rebuy', { playerId, amount: numAmount });
}

function declineRebuy(playerId) {
  socket.emit('decline-rebuy', { playerId });
}

function acceptJoin(spectatorId) {
  socket.emit('accept-join', { spectatorId });
}

function declineJoin(spectatorId) {
  socket.emit('decline-join', { spectatorId });
}

function endGame() {
  if (!confirm('End the game for everyone? This will destroy the room and kick all players.')) return;
  socket.emit('end-game');
// Brief delay to let the emit flush to the server before reload.
  setTimeout(() => {
  location.reload();
}, 200);
}

// -------------------------
// SIDEBAR RENDERING
// -------------------------
function renderSidebar() {
  if (!currentRoom) return;
  const playersDiv = document.getElementById('sidebar-players');
  const spectatorsDiv = document.getElementById('sidebar-spectators');
  const players = [...currentRoom.players].sort((a,b) => a.seatIndex - b.seatIndex);
  playersDiv.innerHTML = players.map(p => {
    const isMe = p.id === mySocketId;
    let status = '';
    if (p.hasRebought) status = '(rebuying — next hand)';
    else if (p.folded) status = '(folded)';
    else if (p.allIn) status = '(all-in)';
    else if (p.isSittingOut) status = '(sitting out)';
    return `<div class="sidebar-player ${isMe ? 'me' : ''} ${p.folded ? 'folded' : ''}">
      <span class="sp-name">${escapeHtml(p.name)} ${escapeHtml(status)}</span>
      <span class="sp-chips">$${p.chips}</span>
    </div>`;
  }).join('');
  const specs = currentRoom.spectators || [];
  if (specs.length === 0) {
    spectatorsDiv.innerHTML = '<div class="sidebar-spectator"><span class="sp-name" style="opacity:0.5;">None</span></div>';
  } else {
    spectatorsDiv.innerHTML = specs.map(s => {
      const isMe = s.id === mySocketId;
      let tag = '';
      if (s.wantsJoin && !s.joinApproved) tag = '<span class="join-tag">pending</span>';
      else if (s.joinApproved) tag = '<span class="join-tag" style="color:var(--btn-secondary);">approved</span>';
      return `<div class="sidebar-spectator ${s.wantsJoin ? 'wants-join' : ''}">
        <span class="sp-name">${escapeHtml(s.name)}${isMe ? ' (you)' : ''}</span>
        ${tag}
      </div>`;
    }).join('');
  }
}

// -------------------------
// TABLE RENDERING
// -------------------------
function renderTable() {
  if (!currentRoom) return;
  renderSidebar();
  const seatsContainer = document.getElementById('seats-container');
  seatsContainer.innerHTML = '';
  const tableEl = document.getElementById('poker-table');
  const tableWidth = tableEl.offsetWidth;
  const tableHeight = tableEl.offsetHeight;
  const rx = tableWidth * 0.42;
  const ry = tableHeight * 0.38;
  const cx = tableWidth / 2;
  const cy = tableHeight / 2;
  const maxPlayers = currentRoom.settings.maxPlayers;
  const seatMap = {};
  currentRoom.players.forEach(p => { seatMap[p.seatIndex] = p; });
  for (let seatIdx = 0; seatIdx < maxPlayers; seatIdx++) {
    const angle = (seatIdx / maxPlayers) * Math.PI * 2 - Math.PI / 2;
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    const seat = document.createElement('div');
    seat.dataset.seat = seatIdx;
    seat.style.left = (x - 42) + 'px';
    seat.style.top = (y - 35) + 'px';
    const p = seatMap[seatIdx];
    if (!p) {
      seat.className = 'seat empty';
      seat.innerHTML = `
        <div class="seat-cards"></div>
        <div class="seat-name">Empty Seat</div>
        <div class="seat-chips">&nbsp;</div>
      `;
    } else {
      seat.className = 'seat';
      if (currentRoom.gameState.currentPlayerIndex === p.seatIndex && !p.folded && currentRoom.gameState.status === 'playing') {
        seat.classList.add('active');
      }
      if (p.folded || p.isSittingOut) seat.classList.add('folded');
      let cardsHtml = '<div class="seat-cards">';
      if (p.holeCards && p.holeCards.length > 0) {
        p.holeCards.forEach(c => {
          const isRed = RED_SUITS[c.s];
          cardsHtml += `<div class="card ${isRed ? 'red' : ''}"><div class="card-rank">${displayRank(c.r)}</div><div class="card-suit">${SUIT_SYMBOLS[c.s]}</div></div>`;
        });
      } else if (!p.folded && currentRoom.gameState.status === 'playing') {
        cardsHtml += '<div class="card card-back"></div><div class="card card-back"></div>';
      }
      cardsHtml += '</div>';
      seat.innerHTML = `
        ${cardsHtml}
        <div class="seat-name">${escapeHtml(p.name)}</div>
        <div class="seat-chips">$${p.chips}</div>
        ${p.currentBet > 0 ? `<div class="seat-bet">Bet: $${p.currentBet}</div>` : ''}
        ${currentRoom.gameState.dealerIndex === p.seatIndex ? '<div class="dealer-button">D</div>' : ''}
      `;
    }
    seatsContainer.appendChild(seat);
  }
  const ccDiv = document.getElementById('community-cards');
  ccDiv.innerHTML = '';
  currentRoom.gameState.communityCards.forEach(c => {
    const isRed = RED_SUITS[c.s];
    ccDiv.innerHTML += `<div class="card ${isRed ? 'red' : ''}"><div class="card-rank">${displayRank(c.r)}</div><div class="card-suit">${SUIT_SYMBOLS[c.s]}</div></div>`;
  });
  const potDiv = document.getElementById('pot-display');
  const totalPot = currentRoom.gameState.pots.reduce((s, p) => s + p.amount, 0);
  potDiv.innerHTML = `Pot: $${totalPot}`;
  const startOverlay = document.getElementById('start-overlay');
  const startBtn = document.getElementById('btn-start-game');
  const waitingText = document.getElementById('waiting-text');
  const nextHandOverlay = document.getElementById('next-hand-overlay');
  const me = currentRoom.players.find(p => p.id === mySocketId);
  const isHost = currentRoom.hostId === mySocketId;
  if (currentRoom.gameState.status === 'waiting') {
    startOverlay.classList.remove('hidden');
    nextHandOverlay.classList.add('hidden');
    if (isHost) {
      startBtn.style.display = 'inline-block';
      waitingText.style.display = 'none';
      // Count players who WILL be active next hand:
      // - players with chips > 0 who aren't sitting out
      // - players who have rebought (will be activated at hand start)
      // - approved spectators in joinQueue (will be seated at hand start)
      const activePlayers = currentRoom.players.filter(p => {
        if (p.hasRebought) return true;
        return !p.isSittingOut && p.chips > 0;
      });
      const approvedSpectators = (currentRoom.spectators || []).filter(s => s.joinApproved).length;
      const totalPotential = activePlayers.length + approvedSpectators;
      if (totalPotential < 2) {
        startBtn.disabled = true;
        startBtn.innerText = 'Need 2+ Players';
      } else {
        startBtn.disabled = false;
        startBtn.innerText = 'START GAME';
      }
    } else {
      startBtn.style.display = 'none';
      waitingText.style.display = 'block';
      waitingText.innerText = 'Waiting for host to start the game...';
    }
  } else {
    startOverlay.classList.add('hidden');
  }
  const turnIndicator = document.getElementById('turn-indicator');
  const actionStatus = document.getElementById('action-status');
  const isMyTurn = currentRoom.gameState.currentPlayerIndex === me?.seatIndex
    && !me?.folded
    && !me?.allIn
    && currentRoom.gameState.status === 'playing'
    && !isSpectator;
  if (isMyTurn) {
    turnIndicator.classList.remove('hidden');
    actionStatus.innerText = '';
  } else if (currentRoom.gameState.status === 'playing' && currentRoom.gameState.bettingRound !== 'showdown') {
    turnIndicator.classList.add('hidden');
    const currentPlayer = currentRoom.players.find(p => p.seatIndex === currentRoom.gameState.currentPlayerIndex);
    if (currentPlayer) {
      actionStatus.innerText = `Waiting for ${currentPlayer.name} to act...`;
    } else {
      actionStatus.innerText = '';
    }
  } else {
    turnIndicator.classList.add('hidden');
    if (currentRoom.gameState.bettingRound === 'showdown') {
      actionStatus.innerText = 'Hand complete — waiting for host to start next hand...';
    } else {
      actionStatus.innerText = '';
    }
  }
  const disableActions = isSpectator || !isMyTurn;
  document.getElementById('btn-fold').disabled = disableActions;
  document.getElementById('btn-check').disabled = disableActions || (currentRoom.gameState.currentBet > (me?.currentBet || 0));
  document.getElementById('btn-call').disabled = disableActions || (currentRoom.gameState.currentBet === (me?.currentBet || 0));
  document.getElementById('btn-raise').disabled = disableActions;
  document.getElementById('btn-allin').disabled = disableActions;
  const callAmount = currentRoom.gameState.currentBet - (me?.currentBet || 0);
  const actualCall = Math.min(callAmount, me?.chips || 0);
  document.getElementById('btn-call').innerText = actualCall > 0 ? `Call $${actualCall}` : 'Call';
  if (isMyTurn) {
    const minRaise = currentRoom.gameState.currentBet + currentRoom.gameState.minRaise;
    document.getElementById('raise-amount').min = minRaise;
    document.getElementById('raise-amount').placeholder = `Min $${minRaise}`;
  } else {
    document.getElementById('raise-amount').placeholder = 'Amt';
  }
  if (currentRoom.gameState.timerEnd && currentRoom.gameState.status === 'playing' && currentRoom.settings.timerEnabled) {
    const endTime = currentRoom.gameState.timerEnd;
    if (endTime > Date.now()) {
      startTimerCountdown(endTime);
    }
  } else {
    document.getElementById('timer-bar-container').style.display = 'none';
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }
}

// -------------------------
// GAME ACTIONS
// -------------------------
function startGame() {
  socket.emit('start-game');
  playSound('click');
}

function startNextHand() {
  socket.emit('start-next-hand');
  playSound('click');
  document.getElementById('next-hand-overlay').classList.add('hidden');
}

function sendAction(action) {
  socket.emit('action', { action });
  playSound('click');
}

function sendRaise() {
  const amount = parseInt(document.getElementById('raise-amount').value);
  if (!amount) return alert('Enter a raise amount');
  socket.emit('action', { action: 'raise', amount });
  playSound('click');
}

function sendAllIn() {
  const me = currentRoom.players.find(p => p.id === mySocketId);
  if (!me) return;
  socket.emit('action', { action: 'raise', amount: me.chips + me.currentBet });
  playSound('click');
}

function leaveRoom() {
  socket.disconnect();
  location.reload();
}

// -------------------------
// CHAT
// -------------------------
function sendChat() {
  const input = document.getElementById('chat-input');
  if (input.value.trim()) {
    socket.emit('send-chat', input.value.trim());
    input.value = '';
  }
}

function toggleEmojiPicker() {
  const p = document.getElementById('emoji-picker');
  p.style.display = p.style.display === 'none' ? 'grid' : 'none';
}

function sendEmoji(emoji) {
  socket.emit('emoji', emoji);
  document.getElementById('emoji-picker').style.display = 'none';
}

// -------------------------
// HOST SETTINGS
// -------------------------
function openSettings() {
  if (!currentRoom || currentRoom.hostId !== mySocketId) {
    alert('Only the host can access settings.');
    return;
  }
  document.getElementById('settings-modal').classList.add('show');
  updateSettingsUI();
}

function closeSettings() {
  document.getElementById('settings-modal').classList.remove('show');
}

function updateSettingsUI() {
  if (!currentRoom) return;
  const kickSel = document.getElementById('kick-select');
  const chipSel = document.getElementById('editchips-select');
  const prevKick = kickSel.value;
  const prevChip = chipSel.value;
  kickSel.innerHTML = '';
  chipSel.innerHTML = '';
  currentRoom.players.forEach(p => {
    if (p.id !== mySocketId) {
      kickSel.innerHTML += `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} (player, $${p.chips})</option>`;
    }
    chipSel.innerHTML += `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} ($${p.chips})</option>`;
  });
  (currentRoom.spectators || []).forEach(s => {
    kickSel.innerHTML += `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} (spectator)</option>`;
  });
  if (prevKick && [...kickSel.options].some(o => o.value === prevKick)) kickSel.value = prevKick;
  if (prevChip && [...chipSel.options].some(o => o.value === prevChip)) chipSel.value = prevChip;
  const maxInput = document.getElementById('settings-max-players');
  if (maxInput && !maxInput.value) maxInput.value = currentRoom.settings.maxPlayers;
  const rebuysStatus = document.getElementById('rebuys-status');
  if (rebuysStatus) {
    rebuysStatus.innerText = currentRoom.settings.rebuysAllowed ? 'Allowed (ON)' : 'Disabled (OFF)';
  }
  const timerStatus = document.getElementById('timer-status');
  if (timerStatus) {
    timerStatus.innerText = currentRoom.settings.timerEnabled ? 'Enabled' : 'Disabled';
  }
  const timerDurInput = document.getElementById('settings-timer-duration');
  if (timerDurInput && !timerDurInput.value) timerDurInput.value = currentRoom.settings.timerSeconds;

  const rebuyList = document.getElementById('rebuy-requests-list');
  if (rebuyList) {
    const requests = currentRoom.rebuyRequests || [];
    if (requests.length === 0) {
      rebuyList.innerHTML = '<p class="no-notifications">No pending requests.</p>';
    } else {
      rebuyList.innerHTML = requests.map(r => `
        <div class="notification-card">
          <div class="notif-title">${escapeHtml(r.playerName)} wants to rebuy</div>
          <div class="notif-detail">Requested: $${r.amount}</div>
          <div class="notif-actions">
            <input type="number" value="${r.amount}" id="rebuy-approve-amount-${escapeHtml(r.playerId)}" style="width:80px;">
            <button class="btn btn-secondary" onclick="approveRebuy('${escapeHtml(r.playerId)}', document.getElementById('rebuy-approve-amount-${escapeHtml(r.playerId)}').value)">Approve</button>
            <button class="btn btn-danger" onclick="declineRebuy('${escapeHtml(r.playerId)}')">Decline</button>
          </div>
        </div>
      `).join('');
    }
  }

  const joinList = document.getElementById('join-requests-list');
  if (joinList) {
    const requests = currentRoom.joinRequests || [];
    if (requests.length === 0) {
      joinList.innerHTML = '<p class="no-notifications">No pending requests.</p>';
    } else {
      joinList.innerHTML = requests.map(r => `
        <div class="notification-card">
          <div class="notif-title">${escapeHtml(r.name)} wants to join</div>
          <div class="notif-detail">${r.approved ? 'Approved — will join next hand' : 'Pending approval'}</div>
          ${!r.approved ? `
          <div class="notif-actions">
            <button class="btn btn-secondary" onclick="acceptJoin('${escapeHtml(r.spectatorId)}')">Accept</button>
            <button class="btn btn-danger" onclick="declineJoin('${escapeHtml(r.spectatorId)}')">Decline</button>
          </div>
          ` : ''}
        </div>
      `).join('');
    }
  }
}

function toggleTimer() {
  socket.emit('host-action', { type: 'toggle-timer' });
}

function changeTimerDuration() {
  const dur = document.getElementById('settings-timer-duration').value;
  if (!dur) return;
  socket.emit('host-action', { type: 'change-timer-duration', amount: dur });
}

function kickPlayer() {
  const playerId = document.getElementById('kick-select').value;
  if (!playerId) return;
  if (!confirm('Kick this person? Players become spectators; spectators are removed entirely.')) return;
  socket.emit('host-action', { type: 'kick', playerId });
}

function editChips() {
  const playerId = document.getElementById('editchips-select').value;
  const amount = parseInt(document.getElementById('editchips-amount').value);
  if (!playerId) return alert('Select a player');
  if (isNaN(amount) || amount < 0) return alert('Enter a valid chip amount');
  socket.emit('host-action', { type: 'edit-chips', playerId, amount });
  document.getElementById('editchips-amount').value = '';
}

function changePassword() {
  const pw = document.getElementById('new-password').value;
  socket.emit('host-action', { type: 'change-password', password: pw });
  document.getElementById('new-password').value = '';
  alert('Password updated.');
}

function toggleRebuys() {
  socket.emit('host-action', { type: 'toggle-rebuys' });
}

function changeMaxPlayers() {
  const amount = parseInt(document.getElementById('settings-max-players').value);
  if (!amount) return;
  if (amount < 2) return alert('Max players must be at least 2');
  if (amount > 12) return alert('Maximum is 12 players. Please enter a number between 2 and 12.');
  socket.emit('host-action', { type: 'change-max-players', amount });
}

// -------------------------
// MISC
// -------------------------
function copyCode() {
  navigator.clipboard.writeText(currentRoom.id);
  alert('Room code copied: ' + currentRoom.id);
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  document.getElementById('sound-btn').innerText = soundEnabled ? '🔊' : '🔇';
  document.getElementById('sound-btn').style.opacity = soundEnabled ? '1' : '0.5';
}

function toggleChat() {
  document.getElementById('chat-container').classList.toggle('active');
}

window.addEventListener('resize', () => { if (currentRoom) renderTable(); });

const STORAGE_KEY = 'courtside-v1';

let state = {
  players: [],
  groups: [],
  session: null,
  currentMatch: null,
  screen: 'home',
  setup: {
    selectedIds: new Set(),
    format: 'rotating',
    scoring: 'sideout',
    pointsTo: 11,
    winBy: 2,
    courts: 2
  },
  quick: {
    scoring: 'sideout',
    pointsTo: 11,
    winBy: 2
  }
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    state.players = data.players || [];
    state.groups = data.groups || [];
    if (data.session) state.session = data.session;
  } catch (e) {}
}

function saveState() {
  try {
    const toSave = {
      players: state.players,
      groups: state.groups,
      session: state.session
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {}
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 2200);
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showScreen(name) {
  state.screen = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + name);
  if (el) el.classList.add('active');
  const back = document.getElementById('btn-back');
  if (back) back.classList.toggle('hidden', name === 'home');
  const titles = {
    home: 'CourtSide',
    players: 'Players',
    setup: 'Round Robin Setup',
    session: 'Session',
    scoring: 'Scoring',
    quick: 'Quick Match',
    quickstart: 'Quick Start'
  };
  const ht = document.getElementById('header-title');
  if (ht) ht.textContent = titles[name] || 'CourtSide';
  if (name === 'players') { renderPlayers(); renderGroups(); }
  if (name === 'setup') renderSetup();
  if (name === 'session') renderSession();
  if (name === 'home') renderHome();
  if (name === 'quick') renderQuick();
}

function addPlayer(name) {
  name = (name || '').trim();
  if (!name) { toast('Enter a name'); return; }
  if (state.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    toast('Player already exists');
    return;
  }
  state.players.push({ id: uid(), name });
  saveState();
  const input = document.getElementById('new-player-name');
  if (input) input.value = '';
  renderPlayers();
  toast('Added ' + name);
}

function removePlayer(id) {
  state.players = state.players.filter(p => p.id !== id);
  saveState();
  renderPlayers();
}

function renderPlayers() {
  const list = document.getElementById('player-list');
  const count = document.getElementById('player-count');
  if (!list) return;
  list.innerHTML = '';
  state.players.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = '<span>' + escapeHtml(p.name) + '</span><button class="icon-btn" data-id="' + p.id + '">✕</button>';
    list.appendChild(li);
  });
  list.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => removePlayer(btn.dataset.id));
  });
  if (count) count.textContent = state.players.length + ' player' + (state.players.length !== 1 ? 's' : '');
}

const ADJECTIVES = ["Swift","Ace","Bold","Cool","Pro","Zen","Fire","Ice","Lucky","Sharp","Fast","Epic","Nova","Blitz","Prime","Max","Sky","Wave","Dash","Flex"];
const NOUNS = ["Dinker","Slammer","Volley","Drop","Drive","Lob","Spin","Smash","Paddle","Kitchen","Net","Serve","Rally","Poach","Third","Ernie","ATP","Banger","Soft","Reset"];

function randomPlayerName(used) {
  for (let i = 0; i < 40; i++) {
    const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const name = a + ' ' + n;
    if (!used.has(name)) { used.add(name); return name; }
  }
  return 'Player ' + (used.size + 1);
}

function createRandomPlayers(count) {
  const used = new Set();
  const players = [];
  for (let i = 0; i < count; i++) players.push({ id: uid(), name: randomPlayerName(used) });
  return players;
}

function saveGroup() {
  const input = document.getElementById('group-name-input');
  const name = (input && input.value || '').trim();
  if (!name) { toast('Enter a group name'); return; }
  if (state.players.length === 0) { toast('Add some players first'); return; }
  const existing = state.groups.find(g => g.name.toLowerCase() === name.toLowerCase());
  const payload = {
    id: existing ? existing.id : uid(),
    name,
    playerIds: state.players.map(p => p.id),
    players: state.players.map(p => ({ id: p.id, name: p.name })),
    savedAt: Date.now()
  };
  if (existing) {
    const idx = state.groups.findIndex(g => g.id === existing.id);
    state.groups[idx] = payload;
    toast('Updated group "' + name + '"');
  } else {
    state.groups.push(payload);
    toast('Saved group "' + name + '"');
  }
  if (input) input.value = '';
  saveState();
  renderGroups();
}

function loadGroup(groupId) {
  const g = state.groups.find(x => x.id === groupId);
  if (!g) return;
  state.players = (g.players || []).map(p => ({ id: p.id || uid(), name: p.name }));
  saveState();
  renderPlayers();
  renderGroups();
  toast('Loaded "' + g.name + '" (' + state.players.length + ' players)');
}

function deleteGroup(groupId) {
  const g = state.groups.find(x => x.id === groupId);
  if (!g) return;
  if (!confirm('Delete group "' + g.name + '"?')) return;
  state.groups = state.groups.filter(x => x.id !== groupId);
  saveState();
  renderGroups();
  toast('Group deleted');
}

function renderGroups() {
  const list = document.getElementById('group-list');
  const count = document.getElementById('group-count');
  if (!list) return;
  list.innerHTML = '';
  if (!state.groups.length) { if (count) count.textContent = '0 groups'; return; }
  const sorted = state.groups.slice().sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  sorted.forEach(g => {
    const n = (g.players || []).length;
    const li = document.createElement('li');
    li.innerHTML = '<div><strong>' + escapeHtml(g.name) + '</strong><br><span class="muted small">' + n + ' players</span></div><div class="group-actions"><button class="load-btn" data-id="' + g.id + '">Load</button><button class="del-btn" data-id="' + g.id + '">✕</button></div>';
    list.appendChild(li);
  });
  list.querySelectorAll('.load-btn').forEach(btn => btn.addEventListener('click', () => loadGroup(btn.dataset.id)));
  list.querySelectorAll('.del-btn').forEach(btn => btn.addEventListener('click', () => deleteGroup(btn.dataset.id)));
  if (count) count.textContent = state.groups.length + ' group' + (state.groups.length !== 1 ? 's' : '');
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateRound(players, courts, partnerHistory) {
  const pool = shuffle(players);
  const matches = [];
  let court = 1;
  for (let i = 0; i + 3 < pool.length && court <= courts; i += 4) {
    matches.push({
      id: uid(),
      court: court++,
      teamA: [pool[i], pool[i+1]],
      teamB: [pool[i+2], pool[i+3]],
      scoreA: 0,
      scoreB: 0,
      completed: false,
      servingTeam: 'A',
      serverNumber: 2
    });
  }
  return matches;
}

function startQuickStart() {
  let count = 8;
  const active = document.querySelector('#qs-count-grid .count-btn.active');
  if (active) count = parseInt(active.dataset.n, 10);
  const custom = parseInt(document.getElementById('qs-custom-count').value, 10);
  if (custom >= 4 && custom <= 32) count = custom;
  const courts = parseInt(document.getElementById('qs-courts').value, 10);
  const pointsTo = parseInt(document.getElementById('qs-points-to').value, 10);
  const winBy = parseInt(document.getElementById('qs-win-by').value, 10);
  let format = 'rotating';
  const fmtBtn = document.querySelector('#qs-format-toggles .toggle-btn.active');
  if (fmtBtn) format = fmtBtn.dataset.format;
  let scoring = 'sideout';
  const scBtn = document.querySelector('#qs-scoring-toggles .toggle-btn.active');
  if (scBtn) scoring = scBtn.dataset.scoring;
  const players = createRandomPlayers(count);
  players.forEach(p => { if (!state.players.some(x => x.id === p.id)) state.players.push(p); });
  const partnerHistory = {};
  const firstRound = generateRound(players, courts, partnerHistory);
  state.session = {
    id: uid(), format, scoring, pointsTo, winBy, courts,
    players: players.map(p => ({ id: p.id, name: p.name })),
    round: 1, matches: firstRound, partnerHistory, stats: {}, history: [], waiting: []
  };
  players.forEach(p => { state.session.stats[p.id] = { wins: 0, losses: 0, pf: 0, pa: 0 }; });
  if (format === 'winners') {
    const playing = new Set();
    firstRound.forEach(m => { m.teamA.forEach(p => playing.add(p.id)); m.teamB.forEach(p => playing.add(p.id)); });
    state.session.waiting = players.filter(p => !playing.has(p.id)).map(p => ({ id: p.id, name: p.name }));
  }
  saveState();
  showScreen('session');
  toast('Quick Start · ' + count + ' players');
}

function addPoint(team) {
  const m = state.currentMatch;
  if (!m || m.completed) return;
  team = (team || '').toString().toUpperCase();
  if (team !== 'A' && team !== 'B') return;
  if (!m.history) m.history = [];
  m.history.push({ scoreA: m.scoreA, scoreB: m.scoreB, servingTeam: m.servingTeam, serverNumber: m.serverNumber });
  const scoring = (state.session && state.session.scoring) || 'sideout';
  if (scoring === 'rally') {
    if (team === 'A') m.scoreA++; else m.scoreB++;
  } else {
    if (team === m.servingTeam) {
      if (team === 'A') m.scoreA++; else m.scoreB++;
    } else {
      if (m.serverNumber === 1) {
        m.serverNumber = 2;
      } else {
        m.servingTeam = m.servingTeam === 'A' ? 'B' : 'A';
        m.serverNumber = 1;
      }
    }
  }
  const pts = (state.session && state.session.pointsTo) || 11;
  const wb = (state.session && state.session.winBy) || 2;
  if ((m.scoreA >= pts || m.scoreB >= pts) && Math.abs(m.scoreA - m.scoreB) >= wb) {
    m.completed = true;
    finishMatch(m);
  }
  updateScoreDisplay();
  updateCourtView(m);
  saveState();
}

function onCourtTap(team) {
  const m = state.currentMatch;
  if (!m || m.completed) return;
  team = (team || '').toString().toUpperCase();
  if (team !== 'A' && team !== 'B') return;
  const sideEl = document.getElementById('tap-side-' + team);
  if (sideEl) {
    const isScore = ((state.session && state.session.scoring) === 'rally') || (team === m.servingTeam);
    sideEl.classList.add(isScore ? 'flash-score' : 'flash-sideout');
    setTimeout(() => sideEl.classList.remove('flash-score', 'flash-sideout'), 180);
  }
  addPoint(team);
}

function undoPoint() {
  const m = state.currentMatch;
  if (!m || !m.history || !m.history.length) { toast('Nothing to undo'); return; }
  const prev = m.history.pop();
  m.scoreA = prev.scoreA;
  m.scoreB = prev.scoreB;
  m.servingTeam = prev.servingTeam;
  m.serverNumber = prev.serverNumber;
  m.completed = false;
  updateScoreDisplay();
  updateCourtView(m);
  saveState();
}

function switchServer() {
  const m = state.currentMatch;
  if (!m) return;
  m.servingTeam = m.servingTeam === 'A' ? 'B' : 'A';
  m.serverNumber = 1;
  updateScoreDisplay();
  updateCourtView(m);
  saveState();
}

function updateScoreDisplay() {
  const m = state.currentMatch;
  if (!m) return;
  const classic = document.getElementById('classic-score');
  if (classic) {
    const serveScore = m.servingTeam === 'A' ? m.scoreA : m.scoreB;
    const recvScore = m.servingTeam === 'A' ? m.scoreB : m.scoreA;
    classic.textContent = serveScore + '-' + recvScore + '-' + m.serverNumber;
  }
}

function updateCourtView(m) {
  function sideForScore(score) { return (score % 2 === 0) ? 'right' : 'left'; }
  ['far-left','far-right','near-left','near-right'].forEach(id => {
    const pos = document.getElementById('pos-' + id);
    const badge = document.getElementById('badge-' + id);
    if (pos) pos.classList.remove('serving');
    if (badge) badge.textContent = '';
  });
  const sideA = document.getElementById('tap-side-A');
  const sideB = document.getElementById('tap-side-B');
  if (sideA) sideA.classList.toggle('serving-side', m.servingTeam === 'A');
  if (sideB) sideB.classList.toggle('serving-side', m.servingTeam === 'B');
  if (m.servingTeam === 'B') {
    const serverSide = sideForScore(m.scoreB);
    const partnerSide = serverSide === 'right' ? 'left' : 'right';
    const serverPlayer = m.serverNumber === 1 ? m.teamB[0] : m.teamB[1];
    const partnerPlayer = m.serverNumber === 1 ? m.teamB[1] : m.teamB[0];
    document.getElementById('name-far-' + serverSide).textContent = serverPlayer.name;
    document.getElementById('name-far-' + partnerSide).textContent = partnerPlayer.name;
    document.getElementById('pos-far-' + serverSide).classList.add('serving');
    document.getElementById('badge-far-' + serverSide).textContent = 'SERVE';
  } else {
    document.getElementById('name-far-left').textContent = m.teamB[0].name;
    document.getElementById('name-far-right').textContent = m.teamB[1].name;
  }
  if (m.servingTeam === 'A') {
    const serverSide = sideForScore(m.scoreA);
    const partnerSide = serverSide === 'right' ? 'left' : 'right';
    const serverPlayer = m.serverNumber === 1 ? m.teamA[0] : m.teamA[1];
    const partnerPlayer = m.serverNumber === 1 ? m.teamA[1] : m.teamA[0];
    document.getElementById('name-near-' + serverSide).textContent = serverPlayer.name;
    document.getElementById('name-near-' + partnerSide).textContent = partnerPlayer.name;
    document.getElementById('pos-near-' + serverSide).classList.add('serving');
    document.getElementById('badge-near-' + serverSide).textContent = 'SERVE';
  } else {
    document.getElementById('name-near-left').textContent = m.teamA[0].name;
    document.getElementById('name-near-right').textContent = m.teamA[1].name;
  }
  const pill = document.getElementById('serve-pill');
  if (pill) {
    pill.textContent = 'Serve ' + m.servingTeam + m.serverNumber;
    pill.className = 'serve-pill serving-' + m.servingTeam.toLowerCase();
  }
}

function openMatch(matchId) {
  const m = state.session && state.session.matches.find(x => x.id === matchId);
  if (!m) return;
  state.currentMatch = m;
  if (m.serverNumber == null) m.serverNumber = 2;
  if (!m.servingTeam) m.servingTeam = 'A';
  showScreen('scoring');
  const label = document.getElementById('scoring-match-label');
  if (label) label.textContent = 'Court ' + m.court;
  updateScoreDisplay();
  updateCourtView(m);
}

console.log('CourtSide core loaded');

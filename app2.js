function finishMatch(m) {
  if (!state.session) return;
  const aWon = m.scoreA > m.scoreB;
  const winners = aWon ? m.teamA : m.teamB;
  const losers = aWon ? m.teamB : m.teamA;
  winners.forEach(p => {
    const s = state.session.stats[p.id] || (state.session.stats[p.id] = { wins:0, losses:0, pf:0, pa:0 });
    s.wins++; s.pf += aWon ? m.scoreA : m.scoreB; s.pa += aWon ? m.scoreB : m.scoreA;
  });
  losers.forEach(p => {
    const s = state.session.stats[p.id] || (state.session.stats[p.id] = { wins:0, losses:0, pf:0, pa:0 });
    s.losses++; s.pf += aWon ? m.scoreB : m.scoreA; s.pa += aWon ? m.scoreA : m.scoreB;
  });
  toast('Game over ' + m.scoreA + '-' + m.scoreB);
  saveState();
}

function endGameManual() {
  const m = state.currentMatch;
  if (!m) return;
  if (!confirm('End this game?')) return;
  m.completed = true;
  finishMatch(m);
  saveState();
  showScreen('session');
}

function renderSession() {
  if (!state.session) { showScreen('home'); return; }
  const roundEl = document.getElementById('session-round');
  const fmtEl = document.getElementById('session-format');
  if (roundEl) roundEl.textContent = 'Round ' + state.session.round;
  if (fmtEl) fmtEl.textContent = state.session.format === 'winners' ? 'Winners Stay' : (state.session.format === 'fixed' ? 'Fixed' : 'Rotating');
  const box = document.getElementById('matchups');
  if (!box) return;
  box.innerHTML = '';
  state.session.matches.forEach(m => {
    const card = document.createElement('div');
    card.className = 'match-card' + (m.completed ? ' completed' : '');
    const aNames = m.teamA.map(p => p.name).join(' & ');
    const bNames = m.teamB.map(p => p.name).join(' & ');
    card.innerHTML = '<div class="court-label">Court ' + m.court + (m.completed ? ' · Done' : '') + '</div>' +
      '<div class="match-teams"><div class="team-block"><div class="names">' + escapeHtml(aNames) + '</div><div>' + m.scoreA + '</div></div>' +
      '<div class="vs">vs</div>' +
      '<div class="team-block"><div class="names">' + escapeHtml(bNames) + '</div><div>' + m.scoreB + '</div></div></div>' +
      '<div class="match-actions"><button class="btn btn-primary btn-sm score-open" data-id="' + m.id + '">' + (m.completed ? 'View' : 'Score') + '</button>' +
      '<button class="btn-swap" data-id="' + m.id + '">⇄ Swap</button></div>';
    box.appendChild(card);
  });
  box.querySelectorAll('.score-open').forEach(btn => btn.addEventListener('click', () => openMatch(btn.dataset.id)));
  box.querySelectorAll('.btn-swap').forEach(btn => btn.addEventListener('click', () => openSwapModal(btn.dataset.id)));
  renderStandings('session-standings');
}

function renderStandings(elId) {
  const el = document.getElementById(elId);
  if (!el || !state.session) return;
  const rows = Object.keys(state.session.stats).map(id => {
    const p = state.session.players.find(x => x.id === id) || state.players.find(x => x.id === id);
    const s = state.session.stats[id];
    return { name: p ? p.name : id, ...s };
  }).sort((a,b) => b.wins - a.wins || (b.pf - b.pa) - (a.pf - a.pa));
  if (!rows.length) { el.innerHTML = '<p class="muted">No results yet</p>'; return; }
  el.innerHTML = '<table><thead><tr><th>Player</th><th>W</th><th>L</th><th>+/-</th></tr></thead><tbody>' +
    rows.map(r => '<tr><td>' + escapeHtml(r.name) + '</td><td>' + r.wins + '</td><td>' + r.losses + '</td><td>' + (r.pf - r.pa) + '</td></tr>').join('') +
    '</tbody></table>';
}

function renderHome() {
  const active = document.getElementById('active-session');
  if (active) {
    if (state.session) {
      active.classList.remove('hidden');
      const info = document.getElementById('active-session-info');
      if (info) info.textContent = 'Round ' + state.session.round + ' · ' + (state.session.players||[]).length + ' players';
    } else active.classList.add('hidden');
  }
  renderStandings('home-standings');
}

function renderSetup() {
  const grid = document.getElementById('setup-player-select');
  if (!grid) return;
  grid.innerHTML = '';
  state.players.forEach(p => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'player-chip' + (state.setup.selectedIds.has(p.id) ? ' selected' : '');
    chip.textContent = p.name;
    chip.addEventListener('click', () => {
      if (state.setup.selectedIds.has(p.id)) state.setup.selectedIds.delete(p.id);
      else state.setup.selectedIds.add(p.id);
      renderSetup();
    });
    grid.appendChild(chip);
  });
  const start = document.getElementById('btn-start-rr');
  if (start) start.disabled = state.setup.selectedIds.size < 4;
}

function startRoundRobin() {
  const ids = Array.from(state.setup.selectedIds);
  if (ids.length < 4) { toast('Need at least 4 players'); return; }
  const players = state.players.filter(p => ids.includes(p.id));
  const courts = parseInt(document.getElementById('num-courts').value, 10);
  const pointsTo = parseInt(document.getElementById('points-to').value, 10);
  const winBy = parseInt(document.getElementById('win-by').value, 10);
  let format = 'rotating', scoring = 'sideout';
  const f = document.querySelector('#format-toggles .toggle-btn.active');
  if (f) format = f.dataset.format;
  const s = document.querySelector('#scoring-toggles .toggle-btn.active');
  if (s) scoring = s.dataset.scoring;
  const partnerHistory = {};
  const matches = generateRound(players, courts, partnerHistory);
  state.session = {
    id: uid(), format, scoring, pointsTo, winBy, courts,
    players: players.map(p => ({ id: p.id, name: p.name })),
    round: 1, matches, partnerHistory, stats: {}, history: [], waiting: []
  };
  players.forEach(p => { state.session.stats[p.id] = { wins:0, losses:0, pf:0, pa:0 }; });
  saveState();
  showScreen('session');
  toast('Round Robin started');
}

function nextRound() {
  if (!state.session) return;
  const unfinished = state.session.matches.filter(m => !m.completed);
  if (unfinished.length && !confirm('Some matches not finished. Continue?')) return;
  const players = state.session.players.map(p => ({ id: p.id, name: p.name }));
  state.session.history.push({ round: state.session.round, matches: JSON.parse(JSON.stringify(state.session.matches)) });
  state.session.round += 1;
  state.session.matches = generateRound(players, state.session.courts, state.session.partnerHistory || {});
  saveState();
  renderSession();
  toast('Round ' + state.session.round);
}

function nextRoundWinnersStay() {
  if (!state.session || state.session.format !== 'winners') { nextRound(); return; }
  const newMatches = [];
  let stillWaiting = [...(state.session.waiting || [])];
  let courtNum = 1;
  state.session.matches.forEach(m => {
    if (!m.completed) return;
    const aWon = m.scoreA > m.scoreB;
    const winners = aWon ? m.teamA : m.teamB;
    const losers = aWon ? m.teamB : m.teamA;
    const pool = shuffle([...losers, ...stillWaiting]);
    const f1 = pool.shift(), f2 = pool.shift();
    stillWaiting = pool;
    if (!f1 || !f2) return;
    newMatches.push({
      id: uid(), court: courtNum++,
      teamA: [winners[0], f1], teamB: [winners[1], f2],
      scoreA: 0, scoreB: 0, completed: false, servingTeam: 'A', serverNumber: 2
    });
  });
  if (!newMatches.length) { toast('Need completed matches'); return; }
  state.session.history.push({ round: state.session.round, matches: JSON.parse(JSON.stringify(state.session.matches)) });
  state.session.round += 1;
  state.session.matches = newMatches;
  state.session.waiting = stillWaiting;
  saveState();
  renderSession();
  toast('Winners Stay · Round ' + state.session.round);
}

function endSession() {
  if (!confirm('End session?')) return;
  state.session = null;
  state.currentMatch = null;
  saveState();
  showScreen('home');
}

function renderQuick() {
  const players = state.players;
  document.querySelectorAll('#quick-team-a select, #quick-team-b select').forEach((sel, i) => {
    sel.innerHTML = '<option value="">—</option>' + players.map(p => '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>').join('');
  });
}

function startQuickMatch() {
  const gets = (slot) => {
    const sel = document.querySelector('select[data-slot="' + slot + '"]');
    const id = sel && sel.value;
    return state.players.find(p => p.id === id);
  };
  const a1 = gets('a1'), a2 = gets('a2'), b1 = gets('b1'), b2 = gets('b2');
  if (!a1 || !a2 || !b1 || !b2) { toast('Pick 4 players'); return; }
  let scoring = 'sideout';
  const sc = document.querySelector('#quick-scoring-toggles .toggle-btn.active');
  if (sc) scoring = sc.dataset.scoring;
  const pointsTo = parseInt(document.getElementById('quick-points-to').value, 10);
  const winBy = parseInt(document.getElementById('quick-win-by').value, 10);
  state.session = {
    id: uid(), format: 'quick', scoring, pointsTo, winBy, courts: 1,
    players: [a1,a2,b1,b2].map(p => ({ id: p.id, name: p.name })),
    round: 1, matches: [], partnerHistory: {}, stats: {}, history: [], waiting: []
  };
  [a1,a2,b1,b2].forEach(p => { state.session.stats[p.id] = { wins:0, losses:0, pf:0, pa:0 }; });
  const m = {
    id: uid(), court: 1,
    teamA: [a1, a2], teamB: [b1, b2],
    scoreA: 0, scoreB: 0, completed: false, servingTeam: 'A', serverNumber: 2, history: []
  };
  state.session.matches = [m];
  state.currentMatch = m;
  saveState();
  showScreen('scoring');
  updateScoreDisplay();
  updateCourtView(m);
}

function openSwapModal(matchId) {
  const m = state.session && state.session.matches.find(x => x.id === matchId);
  if (!m) return;
  state._swapMatchId = matchId;
  const all = state.session.players || state.players;
  ['swap-a1','swap-a2','swap-b1','swap-b2'].forEach((id, i) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = i < 2 ? m.teamA[i] : m.teamB[i-2];
    sel.innerHTML = all.map(p => '<option value="' + p.id + '"' + (cur && cur.id === p.id ? ' selected' : '') + '>' + escapeHtml(p.name) + '</option>').join('');
  });
  document.getElementById('swap-modal').classList.remove('hidden');
}

function saveSwap() {
  const m = state.session.matches.find(x => x.id === state._swapMatchId);
  if (!m) return;
  const pick = id => (state.session.players || state.players).find(p => p.id === document.getElementById(id).value);
  const a1 = pick('swap-a1'), a2 = pick('swap-a2'), b1 = pick('swap-b1'), b2 = pick('swap-b2');
  if (!a1||!a2||!b1||!b2) { toast('Select 4 players'); return; }
  const ids = [a1.id,a2.id,b1.id,b2.id];
  if (new Set(ids).size < 4) { toast('No duplicates'); return; }
  m.teamA = [a1,a2]; m.teamB = [b1,b2];
  saveState();
  document.getElementById('swap-modal').classList.add('hidden');
  if (state.currentMatch && state.currentMatch.id === m.id) updateCourtView(m);
  renderSession();
  toast('Players updated');
}

function bindEvents() {
  document.getElementById('btn-back').addEventListener('click', () => {
    if (state.screen === 'scoring') showScreen(state.session ? 'session' : 'home');
    else showScreen('home');
  });
  document.getElementById('btn-players').addEventListener('click', () => showScreen('players'));
  document.getElementById('btn-settings').addEventListener('click', () => toast('Settings · Data stored on this device'));
  document.getElementById('btn-new-rr').addEventListener('click', () => {
    state.setup.selectedIds = new Set(state.players.map(p => p.id));
    showScreen('setup');
  });
  const qs = document.getElementById('btn-quick-start');
  if (qs) qs.addEventListener('click', () => showScreen('quickstart'));
  document.getElementById('btn-quick-match').addEventListener('click', () => showScreen('quick'));
  document.getElementById('btn-resume-session').addEventListener('click', () => showScreen('session'));
  document.getElementById('btn-add-player').addEventListener('click', () => addPlayer(document.getElementById('new-player-name').value));
  document.getElementById('new-player-name').addEventListener('keydown', e => { if (e.key === 'Enter') addPlayer(e.target.value); });
  const sg = document.getElementById('btn-save-group');
  if (sg) sg.addEventListener('click', saveGroup);
  const gi = document.getElementById('group-name-input');
  if (gi) gi.addEventListener('keydown', e => { if (e.key === 'Enter') saveGroup(); });
  document.getElementById('btn-start-rr').addEventListener('click', startRoundRobin);
  document.getElementById('btn-next-round').addEventListener('click', () => {
    if (state.session && state.session.format === 'winners') nextRoundWinnersStay();
    else nextRound();
  });
  document.getElementById('btn-end-session').addEventListener('click', endSession);
  document.getElementById('btn-undo').addEventListener('click', undoPoint);
  document.getElementById('btn-switch-server').addEventListener('click', switchServer);
  document.getElementById('btn-end-game').addEventListener('click', endGameManual);
  const swapBtn = document.getElementById('btn-swap-scoring');
  if (swapBtn) swapBtn.addEventListener('click', () => { if (state.currentMatch) openSwapModal(state.currentMatch.id); });
  document.getElementById('btn-scoring-close').addEventListener('click', () => showScreen(state.session ? 'session' : 'home'));
  document.getElementById('btn-start-quick').addEventListener('click', startQuickMatch);
  const qsGo = document.getElementById('btn-qs-go');
  if (qsGo) qsGo.addEventListener('click', startQuickStart);
  const qsGrid = document.getElementById('qs-count-grid');
  if (qsGrid) qsGrid.addEventListener('click', e => {
    const btn = e.target.closest('.count-btn');
    if (!btn) return;
    qsGrid.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
  ['format-toggles','scoring-toggles','qs-format-toggles','qs-scoring-toggles','quick-scoring-toggles'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', e => {
      const btn = e.target.closest('.toggle-btn');
      if (!btn) return;
      el.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  function wireCourtTap(elId, team) {
    const el = document.getElementById(elId);
    if (!el) return;
    let last = 0;
    const handler = (e) => {
      e.preventDefault(); e.stopPropagation();
      const now = Date.now();
      if (now - last < 300) return;
      last = now;
      onCourtTap(team);
    };
    el.addEventListener('click', handler);
    el.addEventListener('touchend', handler, { passive: false });
  }
  wireCourtTap('tap-side-A', 'A');
  wireCourtTap('tap-side-B', 'B');
  const btn2d = document.getElementById('btn-view-2d');
  const btn3d = document.getElementById('btn-view-3d');
  if (btn2d) btn2d.addEventListener('click', () => {
    btn2d.classList.add('active'); if (btn3d) btn3d.classList.remove('active');
    const cv = document.getElementById('court-view');
    if (cv) { cv.classList.remove('court-3d'); cv.classList.add('court-2d'); }
  });
  if (btn3d) btn3d.addEventListener('click', () => {
    btn3d.classList.add('active'); if (btn2d) btn2d.classList.remove('active');
    const cv = document.getElementById('court-view');
    if (cv) { cv.classList.remove('court-2d'); cv.classList.add('court-3d'); }
  });
  document.getElementById('btn-swap-close').addEventListener('click', () => document.getElementById('swap-modal').classList.add('hidden'));
  document.getElementById('swap-backdrop').addEventListener('click', () => document.getElementById('swap-modal').classList.add('hidden'));
  document.getElementById('btn-swap-save').addEventListener('click', saveSwap);
  const setupAdd = document.getElementById('btn-setup-add-player');
  if (setupAdd) setupAdd.addEventListener('click', () => {
    const inp = document.getElementById('setup-new-player');
    addPlayer(inp && inp.value);
    if (inp) inp.value = '';
    state.setup.selectedIds = new Set(state.players.map(p => p.id));
    renderSetup();
  });
}

function init() {
  loadState();
  bindEvents();
  showScreen('home');
}

document.addEventListener('DOMContentLoaded', init);

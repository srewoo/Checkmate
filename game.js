import { Chess } from './vendor/chess.js';
import { renderBoard } from './board.js';
import { createBoard3D } from './board3d.js';
import { parseSpoken, matchMoves, sayMove } from './parse.js';
import { chromeAIStatus, warmChromeAI, chromeAIMove, chromeAIInterpret } from './ai.js';
import { createVoice, speak } from './voice.js';
import { setupOnline } from './online.js';
import { setAmbient } from './ambient.js';

const $ = (id) => document.getElementById(id);
const KEY = 'checkmate.settings';
const DEFAULTS = { mode: 'local', color: 'w', level: 'medium', engine: 'classic', scene: 'indoor', tilt: true, speak: true, ambient: true };
const settings = { ...DEFAULTS, ...readSaved() };

const chess = new Chess();
const view = { flipped: false, selected: undefined, targets: new Map(), last: undefined };
let myColor = null; // null = this device plays both sides
let thinking = false;
let gameId = 0;

function readSaved() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage disabled: settings just won't persist */ }
}
const heard = (text) => { $('heard').textContent = text; };
const sideName = (c) => (c === 'w' ? 'White' : 'Black');

// ---- engine worker ----
const worker = new Worker('engine-worker.js', { type: 'module' });
const search = (msg) => new Promise((resolve) => {
  const h = (e) => {
    if (e.data.fen !== msg.fen) return;
    worker.removeEventListener('message', h);
    resolve(e.data);
  };
  worker.addEventListener('message', h);
  worker.postMessage(msg);
});

// ---- online ----
const online = setupOnline({
  onOpen(color) {
    settings.mode = 'online';
    $('settings').close();
    newGame(false); // both sides reset locally; broadcasting here would race the first move
    heard(`Connected. You play ${sideName(color)}.`);
  },
  onClose() { update(); heard('Opponent disconnected.'); },
  onMessage(msg) {
    if (msg.t === 'move' && typeof msg.san === 'string' && chess.turn() !== online.color) commit(msg.san, true);
    else if (msg.t === 'new') newGame(false);
  },
});

// ---- rendering ----
function statusText() {
  if (chess.isCheckmate()) return `Checkmate · ${sideName(chess.turn() === 'w' ? 'b' : 'w')} wins`;
  if (chess.isStalemate()) return 'Stalemate · draw';
  if (chess.isDraw()) return 'Draw';
  if (settings.mode === 'online' && !online.open) return 'Waiting for opponent… (open settings to connect)';
  const who = myColor === null ? sideName(chess.turn()) : chess.turn() === myColor ? 'Your turn' : thinking ? 'Computer is thinking…' : 'Opponent to move';
  return `${who}${myColor === null ? ' to move' : ''}${chess.inCheck() ? ' · check!' : ''}`;
}

function update() {
  if (board3d && settings.tilt) board3d.render(chess, view, statusText());
  else renderBoard($('board'), chess, view);
  $('status').textContent = statusText();
  const list = $('moves');
  list.replaceChildren(...pairs(chess.history()).map((p) => Object.assign(document.createElement('li'), { textContent: p })));
  list.scrollTop = list.scrollHeight;
  $('undo').disabled = settings.mode === 'online' || thinking || !chess.history().length;
}
const pairs = (h) => Array.from({ length: Math.ceil(h.length / 2) }, (_, i) => `${h[2 * i]} ${h[2 * i + 1] ?? ''}`);

let audioUnlocked = false; // autoplay policy: sound may only start after a user gesture
let board3d = null;
function applyLook() {
  document.body.dataset.scene = settings.scene;
  if (settings.tilt && !board3d) {
    try { board3d = createBoard3D($('board3d'), onSquare, () => { $('hint').hidden = true; }); } catch (err) {
      console.warn('[checkmate] WebGL unavailable, using the 2D board:', err);
      settings.tilt = false;
    }
  }
  board3d?.setScene(settings.scene);
  document.body.classList.toggle('three', Boolean(board3d && settings.tilt));
  $('board3d').hidden = !(board3d && settings.tilt);
  if (audioUnlocked) setAmbient(settings.scene, settings.ambient);
}
document.addEventListener('pointerdown', () => { audioUnlocked = true; applyLook(); }, { once: true });

// ---- moves ----
const canHumanMove = () =>
  !chess.isGameOver() && !thinking && (myColor === null || chess.turn() === myColor) &&
  (settings.mode !== 'online' || online.open);

function clearSel() { view.selected = undefined; view.targets = new Map(); }

function commit(input, fromPeer = false) {
  let m;
  try { m = chess.move(input); } catch { return null; }
  view.last = m;
  clearSel();
  update();
  if (settings.speak) speak(sayMove(m));
  if (!fromPeer && settings.mode === 'online') online.send({ t: 'move', san: m.san });
  maybeAI();
  return m;
}

async function maybeAI() {
  if (settings.mode !== 'ai' || chess.isGameOver() || chess.turn() === myColor) return;
  const gid = gameId;
  const fen = chess.fen();
  thinking = true;
  update();
  let san;
  let comment;
  if (settings.engine === 'chrome') {
    try {
      if ((await chromeAIStatus()) !== 'available') throw new Error('Chrome AI not ready');
      const { sans } = await search({ fen, level: settings.level, pool: true });
      ({ san, comment } = await chromeAIMove(fen, sans, chess.pgn()));
    } catch (err) {
      console.warn('[checkmate] Chrome AI failed, using classic engine:', err);
      comment = 'Chrome AI unavailable, classic engine moved instead.';
    }
  }
  const [res] = await Promise.all([san ? { san } : search({ fen, level: settings.level }), new Promise((r) => setTimeout(r, 350))]);
  if (gid !== gameId) return;
  thinking = false;
  commit(res.san);
  if (comment) heard(`Computer: ${comment}`);
}

$('board').addEventListener('click', (e) => onSquare(e.target.closest('[data-sq]')?.dataset.sq));

function onSquare(sq) {
  if (!sq || !canHumanMove()) return;
  // ponytail: clicks auto-promote to a queen; say "a8 promote to knight" to underpromote.
  if (view.selected && view.targets.has(sq)) { commit({ from: view.selected, to: sq, promotion: 'q' }); return; }
  const p = chess.get(sq);
  if (p && p.color === chess.turn() && sq !== view.selected) {
    view.selected = sq;
    view.targets = new Map(chess.moves({ square: sq, verbose: true }).map((m) => [m.to, Boolean(m.captured)]));
  } else clearSel();
  update();
}

// ---- commands ----
function undo() {
  if (settings.mode === 'online' || thinking) return;
  chess.undo();
  if (myColor !== null && chess.turn() !== myColor) chess.undo();
  view.last = chess.history({ verbose: true }).at(-1);
  clearSel();
  update();
}

function newGame(broadcast = true) {
  gameId++;
  thinking = false;
  chess.reset();
  clearSel();
  view.last = undefined;
  myColor = settings.mode === 'ai' ? settings.color : settings.mode === 'online' ? online.color : null;
  view.flipped = myColor === 'b';
  if (broadcast && settings.mode === 'online') online.send({ t: 'new' });
  update();
  maybeAI();
}

const runCmd = { undo, flip: () => { view.flipped = !view.flipped; update(); }, new: () => newGame() };
$('undo').onclick = undo;
$('flip').onclick = runCmd.flip;
$('newGame').onclick = runCmd.new;

// ---- voice ----
const voice = createVoice({
  onInterim: (t) => heard(`“${t}”…`),
  onFinal: handleSpeech,
  onState: (on) => { $('mic').setAttribute('aria-pressed', String(on)); $('mic').querySelector('span').textContent = on ? 'Listening' : 'Speak'; },
  onError: heard,
});
if (voice) $('mic').onclick = () => voice.toggle();
else { $('mic').disabled = true; heard('Speech recognition is not available in this browser. Click to move.'); }

async function handleSpeech(alts) {
  heard(`“${alts[0]}”`);
  const cmd = alts.map(parseSpoken).find((i) => i?.cmd);
  if (cmd) return runCmd[cmd.cmd]();
  if (!canHumanMove()) return heard(`“${alts[0]}” · it's not your move.`);

  const legal = chess.moves({ verbose: true });
  let ambiguous;
  for (const a of alts) {
    const c = matchMoves(parseSpoken(a), legal);
    if (c.length === 1) return commit(c[0]);
    if (c.length > 1) ambiguous ??= c;
  }
  if (ambiguous) return heard(`Which one: ${ambiguous.map((m) => m.san).join(' or ')}? Say the starting square too, e.g. “${ambiguous[0].from} to ${ambiguous[0].to}”.`);
  if ((await chromeAIStatus()) === 'available') {
    try {
      const san = await chromeAIInterpret(alts[0], legal.map((m) => m.san));
      if (san && commit(san)) return;
    } catch (err) { console.warn('[checkmate] Chrome AI interpret failed:', err); }
  }
  heard(`No legal move in “${alts[0]}”. Try “knight to f3” or “e2 to e4”.`);
}

// ---- settings dialog ----
const form = $('settingsForm');
const syncGroups = () => {
  $('aiOpts').hidden = form.mode.value !== 'ai';
  $('onlineOpts').hidden = form.mode.value !== 'online';
};

async function refreshAIStatus() {
  const s = await chromeAIStatus();
  $('aiStatus').textContent = {
    available: 'Chrome AI (Gemini Nano) is ready. It picks from the engine\'s best moves and explains them.',
    downloadable: 'Chrome AI model not downloaded yet. Select "Chrome built-in AI" to start the download.',
    downloading: 'Chrome AI model is downloading…',
    unavailable: 'Chrome built-in AI is unavailable here (needs Chrome 138+ on a supported device). The classic engine will play.',
  }[s] ?? s;
}

$('settingsBtn').onclick = () => {
  for (const k of ['mode', 'color', 'level', 'engine', 'scene']) form[k].value = settings[k];
  form.tilt.checked = settings.tilt;
  form.speak.checked = settings.speak;
  form.ambient.checked = settings.ambient;
  syncGroups();
  refreshAIStatus();
  $('settings').returnValue = '';
  $('settings').showModal();
};

form.addEventListener('change', async (e) => {
  syncGroups();
  if (e.target.name === 'scene' || e.target.name === 'ambient') {
    Object.assign(settings, { scene: form.scene.value, ambient: form.ambient.checked });
    applyLook();
    save();
  }
  if (e.target.name === 'engine' && form.engine.value === 'chrome' && (await chromeAIStatus()) === 'downloadable') {
    try {
      // the change event still carries the click's user activation, which the download requires
      await warmChromeAI((p) => { $('aiStatus').textContent = `Downloading Chrome AI model… ${Math.round(p * 100)}%`; });
    } catch (err) { $('aiStatus').textContent = `Couldn't start Chrome AI: ${err.message}`; return; }
    refreshAIStatus();
  }
});

$('settings').addEventListener('close', () => {
  if ($('settings').returnValue !== 'start') return;
  Object.assign(settings, {
    mode: form.mode.value, color: form.color.value, level: form.level.value, engine: form.engine.value,
    scene: form.scene.value, tilt: form.tilt.checked, speak: form.speak.checked, ambient: form.ambient.checked,
  });
  if (settings.mode !== 'online') online.disconnect();
  save();
  applyLook();
  newGame();
});

if (settings.mode === 'online') settings.mode = 'local'; // a reopened window has no live connection
applyLook();
newGame();

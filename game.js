import { Chess } from './vendor/chess.js';
import { renderBoard } from './board.js';
import { createBoard3D } from './board3d.js';
import { sayMove } from './parse.js';
import { search, engineMove, evaluate } from './engines.js';
import { createClock, parseControl, renderClockHud } from './clock.js';
import { resultOf, materialBalance, moveSound } from './result.js';
import { askPromotion, showResult, confirmed } from './dialogs.js';
import { setupSettings } from './settings-ui.js';
import { playSfx } from './sfx.js';
import { chromeAIStatus, chromeAIMove } from './ai.js';
import { speak } from './voice.js';
import { setupVoice } from './voice-ui.js';
import { setupOnline } from './online.js';
import { setAmbient } from './ambient.js';

const $ = (id) => document.getElementById(id);
const KEY = 'checkmate.settings';
const DEFAULTS = { mode: 'local', color: 'w', level: 'medium', engine: 'stockfish', clock: '10+0', scene: 'indoor', theme: 'wood', tilt: true, speak: true, ambient: true, sfx: true };
const settings = { ...DEFAULTS, ...readSaved() };

const chess = new Chess();
const view = { flipped: false, selected: undefined, targets: new Map(), last: undefined };
let myColor = null; // null = this device plays both sides
let thinking = false;
let gameId = 0;
let clock = null; // null = no time control
let ended = null; // resignation or agreed draw: {winner, reason}
let drawOffer = null; // online: 'me' | 'them'
const lowWarned = new Set();
const result = () => resultOf(chess, clock?.state().flagged, ended);
const isOver = () => Boolean(result());
const AGREED = { winner: null, reason: 'Agreed by both players' };

function readSaved() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage disabled: settings just won't persist */ }
}
const heard = (text) => { $('heard').textContent = text; };
const sideName = (c) => (c === 'w' ? 'White' : 'Black');
const other = (c) => (c === 'w' ? 'b' : 'w');
const sfx = (kind) => { if (settings.sfx) playSfx(kind); };

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
    else if (msg.t === 'resign') endGame({ winner: online.color, reason: `${sideName(other(online.color))} resigned` });
    else if (msg.t === 'draw') { drawOffer = 'them'; heard('Your opponent offers a draw.'); update(); }
    else if (msg.t === 'draw-accept' && drawOffer === 'me') endGame(AGREED);
  },
});

// ---- rendering ----
function statusText() {
  const r = result();
  if (r) return r.winner ? `${r.reason} · ${sideName(r.winner)} wins` : `${r.reason} · draw`;
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
  const bal = materialBalance(chess);
  $('material').textContent = bal ? `${sideName(bal > 0 ? 'w' : 'b')} +${Math.abs(bal)}` : 'Material even';
  const idle = isOver() || thinking || (settings.mode === 'online' && !online.open);
  $('resign').disabled = idle;
  $('resign').textContent = $('resign').dataset.armed ? 'Confirm resign' : 'Resign';
  $('draw').disabled = idle || drawOffer === 'me';
  $('draw').textContent = drawOffer === 'them' ? 'Accept draw' : drawOffer === 'me' ? 'Draw offered' : $('draw').dataset.armed ? 'Confirm draw' : 'Offer draw';
  renderClock();
  announce();
}

let announced = false;
function announce() {
  const r = result();
  if (!r) { announced = false; return; }
  if (announced) return;
  announced = true;
  clock?.stop();
  sfx('end');
  const title = !r.winner ? 'Draw' : myColor === null ? `${sideName(r.winner)} wins` : r.winner === myColor ? 'You win!' : 'You lost';
  showResult(title, r.reason, chess.pgn(), () => newGame());
}

let flagSeen = null;
function renderClock() {
  const s = clock?.state() ?? null;
  renderClockHud($('clocks'), s);
  board3d?.setClock(s);
  if (s && s.flagged !== flagSeen) { flagSeen = s.flagged; if (s.flagged) update(); }
  if (s?.running && s[s.turn] < 10000 && !lowWarned.has(s.turn)) { lowWarned.add(s.turn); sfx('low'); }
}
setInterval(renderClock, 200);
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
  board3d?.setTheme(settings.theme);
  document.body.dataset.theme = settings.theme;
  document.body.classList.toggle('three', Boolean(board3d && settings.tilt));
  $('board3d').hidden = !(board3d && settings.tilt);
  if (audioUnlocked) setAmbient(settings.scene, settings.ambient);
}
document.addEventListener('pointerdown', () => { audioUnlocked = true; applyLook(); }, { once: true });

// ---- moves ----
const canHumanMove = () =>
  !isOver() && !thinking && (myColor === null || chess.turn() === myColor) &&
  (settings.mode !== 'online' || online.open);

function clearSel() { view.selected = undefined; view.targets = new Map(); }

function commit(input, fromPeer = false) {
  let m;
  try { m = chess.move(input); } catch { return null; }
  view.last = m;
  drawOffer = null; // a move declines any pending offer
  clock?.moved(m.color);
  if (chess.isGameOver()) clock?.stop();
  clearSel();
  if (!isOver()) sfx(moveSound(m, chess));
  update();
  if (settings.speak) speak(sayMove(m));
  if (!fromPeer && settings.mode === 'online') online.send({ t: 'move', san: m.san });
  maybeAI();
  return m;
}

async function maybeAI() {
  if (settings.mode !== 'ai' || isOver() || chess.turn() === myColor) return;
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
      console.warn('[checkmate] Chrome AI failed, using Stockfish:', err);
      comment = 'Chrome AI unavailable, Stockfish moved instead.';
    }
  }
  const [move] = await Promise.all([san ?? engineMove(fen, settings.level), new Promise((r) => setTimeout(r, 350))]);
  if (gid !== gameId) return;
  thinking = false;
  if (isOver()) return update(); // flagged while thinking
  commit(move);
  if (comment) heard(`Computer: ${comment}`);
}

$('board').addEventListener('click', (e) => onSquare(e.target.closest('[data-sq]')?.dataset.sq));

async function onSquare(sq) {
  if (!sq || !canHumanMove()) return;
  if (view.selected && view.targets.has(sq)) {
    const from = view.selected;
    const promo = chess.moves({ square: from, verbose: true }).some((m) => m.to === sq && m.promotion);
    const promotion = promo ? await askPromotion(chess.turn()) : undefined;
    if (promo && (!promotion || !canHumanMove())) return; // backed out, or the clock ran out meanwhile
    commit({ from, to: sq, promotion });
    return;
  }
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
  if (chess.undo()) clock?.undo();
  if (myColor !== null && chess.turn() !== myColor && chess.undo()) clock?.undo();
  view.last = chess.history({ verbose: true }).at(-1);
  clearSel();
  update();
}

function newGame(broadcast = true) {
  gameId++;
  thinking = false;
  chess.reset();
  ended = null;
  drawOffer = null;
  lowWarned.clear();
  clearSel();
  view.last = undefined;
  myColor = settings.mode === 'ai' ? settings.color : settings.mode === 'online' ? online.color : null;
  view.flipped = myColor === 'b';
  const control = settings.mode === 'online' ? null : parseControl(settings.clock); // ponytail: no clock online, peers would need time sync
  clock = control && createClock(control);
  if (broadcast && settings.mode === 'online') online.send({ t: 'new' });
  update();
  maybeAI();
}

function endGame(r, msg) {
  ended = r;
  if (msg && settings.mode === 'online') online.send(msg);
  clearSel();
  update();
}

function resign() {
  const loser = myColor ?? chess.turn();
  if (!isOver() && confirmed($('resign'), update)) endGame({ winner: other(loser), reason: `${sideName(loser)} resigned` }, { t: 'resign' });
}

async function offerDraw() {
  if (isOver()) return;
  if (settings.mode === 'online') {
    if (drawOffer === 'them') return endGame(AGREED, { t: 'draw-accept' });
    drawOffer = 'me';
    online.send({ t: 'draw' });
    heard('Draw offered. A move by your opponent declines it.');
    return update();
  }
  if (settings.mode !== 'ai') return confirmed($('draw'), update) && endGame(AGREED);
  const fen = chess.fen();
  heard('The computer is considering your draw offer…');
  const score = await evaluate(fen); // side to move's view
  if (fen !== chess.fen() || isOver()) return;
  const mine = chess.turn() === myColor ? -(score ?? 0) : score ?? 0; // the computer's view
  // ponytail: accepts when clearly worse, or when level late in the game; not Stockfish's real draw logic
  if (score !== null && (mine <= -50 || (chess.history().length >= 60 && mine <= 30))) return endGame(AGREED);
  heard('The computer declines the draw.');
}

const runCmd = { undo, flip: () => { view.flipped = !view.flipped; update(); }, new: () => newGame() };
$('undo').onclick = undo;
$('flip').onclick = runCmd.flip;
$('newGame').onclick = runCmd.new;
$('resign').onclick = resign;
$('draw').onclick = offerDraw;

// ---- voice ----
setupVoice({ chess, commit, canHumanMove, runCmd, heard });

// ---- settings dialog ----
setupSettings(settings, {
  onLive() { applyLook(); save(); },
  onStart() {
    if (settings.mode !== 'online') online.disconnect();
    save();
    applyLook();
    newGame();
  },
});

if (settings.mode === 'online') settings.mode = 'local'; // a reopened window has no live connection
if (settings.engine !== 'chrome') settings.engine = 'stockfish'; // pre-Stockfish saves said 'classic'
applyLook();
newGame();

// Renders the game: the board (3D or 2D), status line, move list, buttons, clock, and the end-of-game card.
import { Chess } from './vendor/chess.js';
import { renderBoard } from './board.js';
import { renderClockHud } from './clock.js';
import { materialBalance } from './result.js';
import { showResult } from './dialogs.js';
import { saveGame } from './persist.js';
import { g, $, result, isOver, canHumanMove, sideName, emit, sfx, vsComputer } from './state.js';

let reviewCache = { ply: null, chess: null };
/** The position on screen: the live game, or a copy at `g.review` plies while reviewing. */
export function shown() {
  if (g.review === null) return g.chess;
  if (reviewCache.ply !== g.review || reviewCache.len !== g.chess.history().length) {
    const c = new Chess();
    for (const san of g.chess.history().slice(0, g.review)) c.move(san);
    reviewCache = { ply: g.review, len: g.chess.history().length, chess: c };
  }
  return reviewCache.chess;
}

function statusText() {
  if (g.review !== null) return `Reviewing move ${Math.ceil(g.review / 2)} · click the board to return`;
  if (g.status) return g.status;
  const r = result();
  if (r) return r.winner ? `${r.reason} · ${sideName(r.winner)} wins` : `${r.reason} · draw`;
  if (g.settings.mode === 'online' && !g.online?.open) return 'Waiting for opponent… (open settings to connect)';
  const { chess, myColor } = g;
  const who = myColor === null ? sideName(chess.turn()) : chess.turn() === myColor ? 'Your turn' : g.thinking ? `${g.opponent} is thinking…` : 'Opponent to move';
  return `${who}${myColor === null ? ' to move' : ''}${chess.inCheck() ? ' · check!' : ''}`;
}

function renderMoves() {
  const h = g.chess.history();
  const cur = g.review ?? h.length;
  const cell = (i) => (h[i] ? `<span data-ply="${i + 1}"${i + 1 === cur ? ' class="cur"' : ''}>${h[i]}</span>` : '');
  const list = $('moves');
  // SAN is chess.js output ([a-hKQRBNOx+#=1-8-]), never user text
  list.innerHTML = Array.from({ length: Math.ceil(h.length / 2) }, (_, i) => `<li>${cell(2 * i)} ${cell(2 * i + 1)}</li>`).join('');
  list.querySelector('.cur')?.scrollIntoView({ block: 'nearest' });
}

function renderButtons() {
  const { settings, chess } = g;
  const live = settings.mode !== 'puzzle';
  $('undo').disabled = settings.mode === 'online' || g.thinking || g.busy || !chess.history().length;
  const idle = isOver() || g.thinking || (settings.mode === 'online' && !g.online?.open);
  $('resign').hidden = $('draw').hidden = $('undo').hidden = !live;
  $('resign').disabled = idle;
  $('resign').textContent = $('resign').dataset.armed ? 'Confirm resign' : 'Resign';
  $('draw').disabled = idle || g.drawOffer === 'me';
  $('draw').textContent = g.drawOffer === 'them' ? 'Accept draw' : g.drawOffer === 'me' ? 'Draw offered' : $('draw').dataset.armed ? 'Confirm draw' : 'Offer draw';
  $('newGame').textContent = !live ? 'Next puzzle' : $('newGame').dataset.armed ? 'Confirm new game' : 'New game';
  $('hintBtn').hidden = !vsComputer() && settings.mode !== 'puzzle';
  $('hintBtn').disabled = g.hinting || !canHumanMove();
}

function persist() {
  const { settings, chess, clock } = g;
  const keep = (settings.mode === 'local' || settings.mode === 'ai') && !isOver() && chess.history().length > 0;
  const c = clock?.state();
  saveGame(localStorage, keep && {
    pgn: chess.pgn(), mode: settings.mode, color: settings.color, level: settings.level, clockSetting: settings.clock,
    hintsUsed: g.hintsUsed, clock: c && { w: c.w, b: c.b, turn: c.turn },
  });
}

export function update() {
  const pos = shown();
  const view = g.review === null ? g.view : { ...g.view, selected: undefined, targets: new Map(), last: pos.history({ verbose: true }).at(-1) };
  if (g.board3d && g.settings.tilt) g.board3d.render(pos, view, statusText());
  else renderBoard($('board'), pos, view);
  $('status').textContent = statusText();
  renderMoves();
  const bal = materialBalance(pos);
  $('material').textContent = bal ? `${sideName(bal > 0 ? 'w' : 'b')} +${Math.abs(bal)}` : 'Material even';
  renderButtons();
  persist();
  renderClock();
  announce();
  emit('update');
}

let announced = false;
function announce() {
  const r = result();
  if (!r) { announced = false; return; }
  if (announced) return;
  announced = true;
  g.clock?.stop();
  sfx('end');
  const title = !r.winner ? 'Draw' : g.myColor === null ? `${sideName(r.winner)} wins` : r.winner === g.myColor ? 'You win!' : 'You lost';
  const hints = g.hintsUsed ? ` · ${g.hintsUsed} hint${g.hintsUsed > 1 ? 's' : ''} used` : '';
  showResult(title, r.reason + hints, g.chess.pgn(), () => emit('rematch'));
  emit('gameover', { r, title });
}

const lowWarned = new Set();
let flagSeen = null;
export function resetClockWarnings() { lowWarned.clear(); }
export function renderClock() {
  const s = g.clock?.state() ?? null;
  renderClockHud($('clocks'), s);
  g.board3d?.setClock(s);
  if (s && s.flagged !== flagSeen) { flagSeen = s.flagged; if (s.flagged) update(); }
  if (s?.running && s[s.turn] < 10000 && !lowWarned.has(s.turn)) { lowWarned.add(s.turn); sfx('low'); }
}
setInterval(renderClock, 200);

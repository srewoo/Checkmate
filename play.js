// Moves and commands: committing moves, the computer's reply, clicks on squares, undo, hints, new game, resign, draw.
import { Chess } from './vendor/chess.js';
import { sayMove } from './parse.js';
import { search, engineMove, evaluate } from './engines.js';
import { createClock, parseControl } from './clock.js';
import { moveSound } from './result.js';
import { askPromotion, confirmed } from './dialogs.js';
import { chromeAIStatus, chromeAIMove } from './ai.js';
import { speak } from './voice.js';
import { aiLevel } from './ladder-ui.js';
import { update, resetClockWarnings } from './hud.js';
import { g, $, heard, sideName, other, sfx, isOver, canHumanMove, emit, on, saveSettings } from './state.js';

const AGREED = { winner: null, reason: 'Agreed by both players' };
const clearSel = () => { g.view.selected = undefined; g.view.targets = new Map(); };

/** Plays `input` (SAN or {from,to,promotion}) for the side to move. `by`: 'human' | 'computer' | 'peer' | 'puzzle'. */
export function commit(input, by = 'human') {
  const before = g.chess.fen();
  let m;
  try { m = g.chess.move(input); } catch { return null; }
  g.view.last = m;
  g.drawOffer = null; // a move declines any pending offer
  g.clock?.moved(m.color);
  if (g.chess.isGameOver()) g.clock?.stop();
  clearSel();
  if (!isOver()) sfx(moveSound(m, g.chess));
  update();
  heard(`${sideName(m.color)}: ${sayMove(m)}`); // #heard is a live region: opponent and computer moves get announced
  if (g.settings.speak) speak(sayMove(m));
  if (by !== 'peer' && g.settings.mode === 'online') g.online.send({ t: 'move', san: m.san });
  emit('move', { m, by, before });
  maybeAI();
  return m;
}

async function maybeAI() {
  const { settings, chess } = g;
  if (settings.mode !== 'ai' || isOver() || chess.turn() === g.myColor) return;
  const gid = g.gameId;
  const fen = chess.fen();
  g.thinking = true;
  update();
  let san;
  let comment;
  if (settings.engine === 'chrome' && settings.level !== 'ladder') {
    try {
      if ((await chromeAIStatus()) !== 'available') throw new Error('Chrome AI not ready');
      const { sans } = await search({ fen, level: settings.level, pool: true });
      ({ san, comment } = await chromeAIMove(fen, sans, chess.pgn()));
    } catch (err) {
      console.warn('[checkmate] Chrome AI failed, using Stockfish:', err);
      comment = 'Chrome AI unavailable, Stockfish moved instead.';
    }
  }
  const [move] = await Promise.all([san ?? engineMove(fen, aiLevel(settings)), new Promise((r) => setTimeout(r, 350))]);
  if (gid !== g.gameId) return;
  g.thinking = false;
  if (isOver()) return update(); // flagged while thinking
  commit(move, 'computer');
  if (comment) heard(`Computer: ${comment}`);
}

export async function onSquare(sq) {
  if (g.review !== null) { g.review = null; return update(); } // any click on the board leaves review
  if (!sq || !canHumanMove()) return;
  const { chess, view } = g;
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

export function undo() {
  const { settings, chess } = g;
  if (settings.mode === 'online' || settings.mode === 'puzzle' || g.thinking || g.busy) return;
  g.review = null;
  if (chess.undo()) g.clock?.undo();
  if (g.myColor !== null && chess.turn() !== g.myColor && chess.undo()) g.clock?.undo();
  g.ended = null; // taking back after a resignation or agreed draw reopens the game
  g.drawOffer = null;
  g.view.last = chess.history({ verbose: true }).at(-1);
  clearSel();
  update();
  emit('undo');
  maybeAI(); // playing Black: undoing the computer's first move leaves it to move again
}

/** Highlights a suggested move: the puzzle's solution, or Stockfish's choice vs the computer. */
export async function hint() {
  if (g.hinting || !canHumanMove()) return;
  const fen = g.chess.fen();
  g.hinting = true;
  heard('Looking for a good move…');
  update();
  const m = g.hintMove ? g.hintMove() : await engineMove(fen, 'hard');
  g.hinting = false;
  if (fen !== g.chess.fen() || !canHumanMove()) return update();
  let mv;
  try { mv = new Chess(fen).move(m); } catch { heard('No hint available.'); return update(); }
  g.hintsUsed++;
  g.view.selected = mv.from; // shown as a normal selection with the one suggested target
  g.view.targets = new Map([[mv.to, Boolean(mv.captured)]]);
  heard(`Hint: ${sayMove(mv)}`);
  update();
}

export function newGame(broadcast = true, saved = null) {
  const { settings, chess } = g;
  g.gameId++;
  Object.assign(g, { thinking: false, hinting: false, busy: false, review: null, status: null, hintMove: null, ended: null, drawOffer: null });
  g.hintsUsed = saved?.hintsUsed ?? 0;
  chess.reset();
  if (saved) try { chess.loadPgn(saved.pgn); } catch { chess.reset(); saved = null; }
  resetClockWarnings();
  clearSel();
  g.view.last = chess.history({ verbose: true }).at(-1);
  g.myColor = settings.mode === 'ai' ? settings.color : settings.mode === 'online' ? g.online.color : null;
  g.view.flipped = g.myColor === 'b';
  // ponytail: no clock online (peers would need time sync) or in puzzles (Puzzle Rush keeps its own timer)
  const control = settings.mode === 'local' || settings.mode === 'ai' ? parseControl(settings.clock) : null;
  g.clock = control && createClock(control, undefined, saved?.clock ? { ...saved.clock, plies: chess.history().length } : null);
  if (broadcast && settings.mode === 'online') g.online.send({ t: 'new' });
  g.board3d?.home();
  emit('newgame', { resumed: Boolean(saved) }); // puzzle mode loads its position here
  update();
  maybeAI();
}

export function endGame(r, msg) {
  g.ended = r;
  if (msg && g.settings.mode === 'online') g.online.send(msg);
  clearSel();
  update();
}

export function resign() {
  const loser = g.myColor ?? g.chess.turn();
  if (!isOver() && confirmed($('resign'), update)) endGame({ winner: other(loser), reason: `${sideName(loser)} resigned` }, { t: 'resign' });
}

export async function offerDraw() {
  const { settings, chess } = g;
  if (isOver()) return;
  if (settings.mode === 'online') {
    if (g.drawOffer === 'them') return endGame(AGREED, { t: 'draw-accept' });
    g.drawOffer = 'me';
    g.online.send({ t: 'draw' });
    heard('Draw offered. A move by your opponent declines it.');
    return update();
  }
  if (settings.mode !== 'ai') return confirmed($('draw'), update) && endGame(AGREED);
  const fen = chess.fen();
  heard(`${g.opponent} is considering your draw offer…`);
  const score = await evaluate(fen); // side to move's view
  if (fen !== chess.fen() || isOver()) return;
  const mine = chess.turn() === g.myColor ? -(score ?? 0) : score ?? 0; // the computer's view
  // ponytail: accepts when clearly worse, or when level late in the game; not Stockfish's real draw logic
  if (score !== null && (mine <= -50 || (chess.history().length >= 60 && mine <= 30))) return endGame(AGREED);
  heard(`${g.opponent} declines the draw.`);
}

export function onPeerMessage(msg) {
  const { chess, online } = g;
  if (msg.t === 'move' && typeof msg.san === 'string' && chess.turn() !== online.color) commit(msg.san, 'peer');
  else if (msg.t === 'new') newGame(false);
  else if (msg.t === 'resign') endGame({ winner: online.color, reason: `${sideName(other(online.color))} resigned` });
  else if (msg.t === 'draw') { g.drawOffer = 'them'; heard('Your opponent offers a draw.'); update(); }
  else if (msg.t === 'draw-accept' && g.drawOffer === 'me') endGame(AGREED);
  else emit('peer', msg);
}

on('rematch', () => {
  if (g.settings.mode === 'ai') { g.settings.color = other(g.settings.color); saveSettings(); } // rematch: swap colours
  newGame();
});

// New game wipes the board: once a game is under way it takes two presses (or "new game" said twice), like Resign
export const runCmd = {
  undo,
  flip: () => { g.view.flipped = !g.view.flipped; update(); },
  new: () => (g.settings.mode === 'puzzle' || !g.chess.history().length || isOver() || confirmed($('newGame'), update)) && newGame(),
};

// Shared game state and a tiny event bus. Feature modules (coach, ladder, puzzles, replay, achievements, emotes)
// read `g` and subscribe to events instead of being threaded through the controller.
import { Chess } from './vendor/chess.js';
import { resultOf } from './result.js';
import { playSfx } from './sfx.js';

const KEY = 'checkmate.settings';
export const DEFAULTS = {
  mode: 'local', color: 'w', level: 'medium', style: 'balanced', engine: 'stockfish', clock: '10+0', pz: 'rush', scene: 'indoor', theme: 'wood',
  tilt: true, speak: true, ambient: true, sfx: true, react: true, evalBar: false, panelMin: false,
};

function readSaved() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; }
}
export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(g.settings)); } catch { /* storage disabled: settings just won't persist */ }
}

export const g = {
  settings: { ...DEFAULTS, ...readSaved() },
  chess: new Chess(),
  view: { flipped: false, selected: undefined, targets: new Map(), last: undefined },
  myColor: null, // null = this device plays both sides
  thinking: false, // the computer is choosing a move
  busy: false, // a puzzle reply is playing: input waits
  gameId: 0,
  clock: null, // null = no time control
  ended: null, // resignation or agreed draw: {winner, reason}
  drawOffer: null, // online: 'me' | 'them'
  hintsUsed: 0,
  hinting: false,
  hintMove: null, // a mode's own hint source (puzzles): () => move, null = ask Stockfish
  review: null, // ply being reviewed, null = live position
  reviewSide: null, // an imported PGN: the colour the player had in it (for the coach card), else null
  status: null, // a mode's own status line (puzzles), null = the default
  opponent: 'Computer', // display name of the computer side
  online: null, // set by game.js
  board3d: null, // set by game.js; null = 2D board
};

export const $ = (id) => document.getElementById(id);
export const sideName = (c) => (c === 'w' ? 'White' : 'Black');
export const other = (c) => (c === 'w' ? 'b' : 'w');
export const heard = (text) => { $('heard').textContent = text; };
export const sfx = (kind) => { if (g.settings.sfx) playSfx(kind); };
export const vsComputer = () => g.settings.mode === 'ai';

export const result = () => (g.settings.mode === 'puzzle' ? null : resultOf(g.chess, g.clock?.state().flagged, g.ended));
export const isOver = () => Boolean(result());
export const canHumanMove = () =>
  !isOver() && !g.thinking && !g.busy && g.review === null && (g.myColor === null || g.chess.turn() === g.myColor) &&
  (g.settings.mode !== 'online' || Boolean(g.online?.open));

// Events: 'newgame', 'move' {m, by: 'human'|'computer'|'peer'|'puzzle', before}, 'update', 'gameover' {r, title},
// 'rematch', 'undo'.
const bus = new EventTarget();
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
export const on = (type, fn) => bus.addEventListener(type, (e) => fn(e.detail));

// How a game ended, material count, and which sound a move makes. Pure functions over a chess.js game.
const POINTS = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const other = (c) => (c === 'w' ? 'b' : 'w');

/** White's material minus Black's (p1 n3 b3 r5 q9), so a promoted queen counts as a queen. */
export function materialBalance(chess) {
  let s = 0;
  for (const row of chess.board()) for (const p of row) if (p) s += (p.color === 'w' ? 1 : -1) * POINTS[p.type];
  return s;
}

/** A lone king, or king + one minor piece, can't mate: flagging against it is a draw (FIDE 6.9). */
function cantMate(chess, color) {
  const rest = chess.board().flat().filter((p) => p && p.color === color && p.type !== 'k');
  return rest.length === 0 || (rest.length === 1 && (rest[0].type === 'n' || rest[0].type === 'b'));
}

/**
 * {winner: 'w'|'b'|null, reason} once the game is over, else null.
 * `flagged` is the side whose clock ran out; `ended` is a resignation or agreed draw ({winner, reason}).
 */
export function resultOf(chess, flagged, ended) {
  if (ended) return ended;
  if (flagged) return cantMate(chess, other(flagged)) ? { winner: null, reason: 'Timeout vs insufficient material' } : { winner: other(flagged), reason: 'Time' };
  if (chess.isCheckmate()) return { winner: other(chess.turn()), reason: 'Checkmate' };
  if (chess.isStalemate()) return { winner: null, reason: 'Stalemate' };
  if (chess.isThreefoldRepetition()) return { winner: null, reason: 'Threefold repetition' };
  if (chess.isInsufficientMaterial()) return { winner: null, reason: 'Insufficient material' };
  if (chess.isDraw()) return { winner: null, reason: '50-move rule' };
  return null;
}

/** Sound for a move just played on `chess`. */
export function moveSound(m, chess) {
  if (chess.inCheck()) return 'check';
  if (m.flags.includes('k') || m.flags.includes('q')) return 'castle';
  if (m.promotion) return 'promote';
  return m.captured ? 'capture' : 'move';
}

// Reading a pasted PGN for review. Pure, unit-tested.
import { Chess } from './vendor/chess.js';

export const MAX_PGN = 100000; // characters; a long game is well under 10k

/**
 * {pgn, headers, plies} for a reviewable game, or {error} with a message for the player. Only games from the normal
 * starting position: review and the move list replay from there.
 */
export function parsePgn(text) {
  const t = String(text ?? '').trim();
  if (!t) return { error: 'Paste a game in PGN first.' };
  if (t.length > MAX_PGN) return { error: 'That PGN is too long to be a single game.' };
  const c = new Chess();
  try { c.loadPgn(t); } catch { return { error: "Couldn't read that PGN. Check it's one game with legal moves." }; }
  const headers = c.getHeaders();
  if (headers.SetUp === '1' || headers.FEN) return { error: 'Only games from the normal starting position can be reviewed.' };
  const plies = c.history().length;
  if (plies < 2) return { error: 'That game has fewer than two moves.' };
  return { pgn: c.pgn(), headers, plies };
}

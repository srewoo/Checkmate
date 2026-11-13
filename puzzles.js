// Puzzle selection and move judging over the bundled Lichess set (puzzles-data.js). Pure functions, unit-tested.
// A puzzle's moves are UCI: [opponent's setup move, solver, opponent, solver, ...].
import { PUZZLES } from './puzzles-data.js';

export const toPuzzle = ([id, fen, moves, rating, themes]) => ({ id, fen, moves: moves.split(' '), rating, themes: themes ? themes.split(' ') : [] });
export const uci = (m) => m.from + m.to + (m.promotion ?? '');
export const fromUci = (u) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });

/** Today's puzzle: the same for everyone on a given (local) date, rated 1200-1800. */
export function daily(date, list = PUZZLES) {
  const pool = list.filter((p) => p[3] >= 1200 && p[3] <= 1800);
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 864e5);
  const mix = Math.imul(day, 2654435761) >>> 0; // Knuth multiplicative hash: neighbouring days land far apart
  return toPuzzle(pool[mix % pool.length]);
}

/**
 * A random pick among the 40 unseen puzzles rated closest to `rating` (so a target past the top gets the hardest).
 * With `themes`, only puzzles carrying one of them, unless fewer than 10 do.
 */
export function near(rating, seen = new Set(), rand = Math.random, list = PUZZLES, themes = null) {
  if (themes?.length) {
    const themed = list.filter((p) => p[4] && p[4].split(' ').some((t) => themes.includes(t)));
    if (themed.length >= 10) list = themed;
  }
  const fresh = list.filter((p) => !seen.has(p[0]));
  const pool = (fresh.length ? fresh : list).slice().sort((a, b) => Math.abs(a[3] - rating) - Math.abs(b[3] - rating)).slice(0, 40);
  return toPuzzle(pool[Math.floor(rand() * pool.length)]);
}

/**
 * Judges the solver's move `m` (chess.js move, already played) at index `ply` of `puzzle.moves`.
 * Any checkmate counts as solving (as on Lichess), since some puzzles have more than one mate.
 */
export function judge(puzzle, ply, m, mated) {
  if (mated) return 'solved';
  if (uci(m) !== puzzle.moves[ply]) return 'wrong';
  return ply >= puzzle.moves.length - 1 ? 'solved' : 'correct';
}

/** Puzzle Rush difficulty: starts easy and climbs ~90 points per solve. */
export const rushRating = (solved) => 650 + solved * 90;

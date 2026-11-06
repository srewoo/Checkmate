// Achievements: a fixed list of goals, checked on game events, unlocked once, kept in localStorage.
// `check(event, ctx)` is pure apart from the unlocked set passed in, so it's unit-tested.
const KEY = 'checkmate.achievements';

/** id -> {name, how}. Order is the display order. */
export const ACHIEVEMENTS = {
  firstWin: { name: 'First blood', how: 'Win a game against the computer' },
  hardWin: { name: 'Hard as nails', how: 'Beat the computer on Hard or Master without hints' },
  noHints: { name: 'Unassisted', how: 'Beat the computer on Medium or above without hints' },
  quick: { name: 'Blitzkrieg', how: 'Checkmate the computer in under 25 moves, no hints' },
  knightMate: { name: 'Horse play', how: 'Deliver checkmate with a knight' },
  pawnMate: { name: 'Humble hero', how: 'Deliver checkmate with a pawn' },
  greatMove: { name: 'Brilliant!', how: 'Play a move rated "Great" vs the computer' },
  sharp: { name: 'Sharpshooter', how: 'Finish a game with 90%+ accuracy, no hints' },
  rung3: { name: 'Climber', how: 'Beat 3 ladder opponents' },
  ladder: { name: 'King of the ladder', how: 'Beat The Grandmaster' },
  puzzles10: { name: 'Puzzler', how: 'Solve 10 puzzles' },
  puzzles50: { name: 'Puzzle master', how: 'Solve 50 puzzles' },
  rush10: { name: 'Rush hour', how: 'Score 10 in Puzzle Rush' },
  rush20: { name: 'Speed demon', how: 'Score 20 in Puzzle Rush' },
  streak7: { name: 'Habit', how: 'Solve the daily puzzle 7 days in a row' },
};

/**
 * Ids newly earned by an event. ctx fields used per event:
 * win: {level, hints, plies, mateBy (piece letter or null)}; reaction: {kind}; summary: {accuracy, hints};
 * ladder: {beaten, total}; puzzle: {solved}; rush: {score}; daily: {streak}.
 */
export function check(event, ctx, unlocked) {
  const earned = [];
  const want = (id, cond) => { if (cond && !unlocked.has(id)) earned.push(id); };
  if (event === 'win') {
    const clean = ctx.hints === 0; // only the first win can be had with hints; the rest must be your own play
    want('firstWin', true);
    want('hardWin', clean && ['hard', 'master'].includes(ctx.level));
    want('noHints', clean && ['medium', 'hard', 'master', 'ladder'].includes(ctx.level));
    want('quick', clean && ctx.mateBy && ctx.plies < 50);
    want('knightMate', clean && ctx.mateBy === 'n');
    want('pawnMate', clean && ctx.mateBy === 'p');
  }
  if (event === 'reaction') want('greatMove', ctx.kind === 'great');
  if (event === 'summary') want('sharp', ctx.hints === 0 && ctx.accuracy >= 90);
  if (event === 'ladder') { want('rung3', ctx.beaten >= 3); want('ladder', ctx.beaten >= ctx.total); }
  if (event === 'puzzle') { want('puzzles10', ctx.solved >= 10); want('puzzles50', ctx.solved >= 50); }
  if (event === 'rush') { want('rush10', ctx.score >= 10); want('rush20', ctx.score >= 20); }
  if (event === 'daily') want('streak7', ctx.streak >= 7);
  return earned;
}

export function loadUnlocked(storage) {
  try { return new Set(JSON.parse(storage.getItem(KEY)) ?? []); } catch { return new Set(); }
}
export function saveUnlocked(storage, set) {
  try { storage.setItem(KEY, JSON.stringify([...set])); } catch { /* not persisted */ }
}

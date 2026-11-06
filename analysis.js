// Move-quality maths over Stockfish scores. Pure functions, unit-tested.
const MATE = 100000;

/** Centipawns for the side to move -> win chance 0..100 for that side (Lichess's logistic curve). */
export function winChance(cp) {
  const c = Math.max(-1500, Math.min(1500, Math.abs(cp) >= MATE ? Math.sign(cp) * 1500 : cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

/** Per-move accuracy 0..100 from the mover's win chance before and after the move (Lichess's formula). */
export function moveAccuracy(before, after) {
  const drop = Math.max(0, before - after);
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669));
}

/**
 * Classifies one move. `before`: score for the mover before moving; `after`: score for the opponent after it
 * (both as Stockfish reports them, side to move's view). Returns {kind, drop} where kind is one of
 * 'great' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'missed-mate' | null (unremarkable).
 */
export function classify(before, after, { capture = false, check = false } = {}) {
  const mine = -after; // the mover's view after the move
  const wBefore = winChance(before);
  const wAfter = winChance(mine);
  const drop = wBefore - wAfter;
  if (before >= MATE && mine < MATE) return { kind: 'missed-mate', drop };
  if (drop >= 30) return { kind: 'blunder', drop };
  if (drop >= 20) return { kind: 'mistake', drop };
  if (drop >= 10) return { kind: 'inaccuracy', drop };
  // a "great" move keeps the best line and turns the game: wins material or checks into a big edge
  if (drop <= 2 && wAfter >= 70 && wBefore < 70 && (capture || check || mine >= MATE)) return { kind: 'great', drop };
  return { kind: null, drop };
}

/** {accuracy, counts: {inaccuracy, mistake, blunder}} for one side from per-move [before, after] pairs. */
export function summarize(pairs) {
  const counts = { inaccuracy: 0, mistake: 0, blunder: 0 };
  let total = 0;
  for (const [before, after] of pairs) {
    const { kind } = classify(before, after);
    if (kind in counts) counts[kind]++;
    if (kind === 'missed-mate') counts.mistake++;
    total += moveAccuracy(winChance(before), winChance(-after));
  }
  return { accuracy: pairs.length ? Math.round(total / pairs.length) : null, counts };
}

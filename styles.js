// Opponent styles: the engine plays at its set strength, then a style picks among its near-equal candidate moves
// (Stockfish MultiPV) with a taste for checks, captures, castling... Strength barely moves because a style may only
// choose moves scored within `budget` centipawns of the engine's own choice. Pure, unit-tested.
import { Chess } from './vendor/chess.js';

/** Multipliers per move feature; a missing feature is 1. `balanced` plays the engine's move unchanged. */
export const STYLES = {
  balanced: null,
  aggressive: { check: 1.7, kingZone: 1.7, capture: 1.3, castle: 0.8, retreat: 0.6 },
  defensive: { castle: 1.8, retreat: 1.5, check: 0.8, kingZone: 0.7, capture: 0.9 },
  tactical: { capture: 1.7, check: 1.5, kingZone: 1.2, retreat: 0.8 },
  positional: { develop: 1.6, castle: 1.4, pawn: 1.2, capture: 0.85, check: 0.8 },
};

const dist = (a, b) => Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(+a[1] - +b[1]));

/** Features of a UCI move in `fen`: {capture, check, pawn, develop, castle, retreat, kingZone}, or null if illegal. */
export function features(fen, uci) {
  const ch = new Chess(fen);
  let m;
  try { m = ch.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); } catch { return null; }
  const enemyKing = ch.board().flat().find((p) => p && p.type === 'k' && p.color !== m.color).square;
  const forward = m.color === 'w' ? +m.to[1] - +m.from[1] : +m.from[1] - +m.to[1];
  const home = m.color === 'w' ? '1' : '8';
  return {
    capture: Boolean(m.captured),
    check: /[+#]/.test(m.san),
    pawn: m.piece === 'p',
    develop: 'nb'.includes(m.piece) && m.from[1] === home,
    castle: /[kq]/.test(m.flags),
    retreat: m.piece !== 'p' && m.piece !== 'k' && forward < 0,
    kingZone: m.piece !== 'k' && dist(m.to, enemyKing) <= 2,
  };
}

/**
 * Picks a UCI move. `lines`: [{uci, score}] from MultiPV (side to move's centipawns), `anchor`: the engine's own
 * (strength-limited) choice. Only candidates within `budget` of the anchor's score are eligible.
 */
export function pickStyled(lines, anchor, fen, style, rand = Math.random, budget = 40) {
  const w = STYLES[style];
  if (!w || !lines.length) return anchor;
  const anchorLine = lines.find((l) => l.uci === anchor);
  const floor = (anchorLine?.score ?? Math.min(...lines.map((l) => l.score))) - budget;
  const pool = lines.filter((l) => l.score >= floor);
  if (!anchorLine) pool.push({ uci: anchor });
  const weighted = pool.map((l) => {
    const f = features(fen, l.uci);
    if (!f) return { uci: l.uci, weight: 0 };
    let weight = l.uci === anchor ? 1.2 : 1;
    for (const [k, on] of Object.entries(f)) if (on) weight *= w[k] ?? 1;
    return { uci: l.uci, weight };
  });
  const total = weighted.reduce((s, x) => s + x.weight, 0);
  let r = rand() * total;
  for (const x of weighted) { r -= x.weight; if (x.weight && r <= 0) return x.uci; }
  return anchor;
}

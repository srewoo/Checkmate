// The coach card on the result screen: your worst moment, one thing that went well, one thing to work on.
// Built from the tagged mistakes of one side. Pure, unit-tested.
import { SKILLS } from './skills.js';
import { classify } from './analysis.js';
import { tagMistake } from './motifs.js';

const SEVERITY = { 'missed-mate': 3, blunder: 3, mistake: 2, inaccuracy: 1 };

const MATE = 100000;

/**
 * Mistakes by `color` in a game: `moves` is chess.js verbose history, `scores[i]` the side to move's score before
 * ply i (scores.length = moves.length + 1; null = unknown). Mistakes and blunders get a skill tag (motifs.js);
 * inaccuracies count for praise but carry no skill. Returns [{ply, san, kind, drop, skill, why}].
 */
export function findMistakes(moves, scores, color) {
  const out = [];
  moves.forEach((m, i) => {
    const [before, after] = [scores[i], scores[i + 1]];
    if (m.color !== color || before == null || after == null) return;
    const { kind, drop } = classify(before, after, { capture: Boolean(m.captured), check: /[+#]/.test(m.san) });
    if (!(kind in SEVERITY)) return;
    const tag = kind === 'inaccuracy' ? { skill: null, why: '' } : tagMistake({
      fenBefore: m.before, fenAfter: m.after, move: m, prevMove: moves[i - 1], ply: i, kind,
      allowedMate: after >= MATE && before > -MATE,
    });
    out.push({ ply: i, san: m.san, kind, drop, ...tag });
  });
  return out;
}

/** "12. Nd5" for White's 12th move, "12… Nd5" for Black's (ply is 0-based). */
export const moveLabel = (ply, san) => `${Math.floor(ply / 2) + 1}${ply % 2 ? '…' : '.'} ${san}`;

/**
 * `mistakes`: [{ply, san, kind, drop, skill, why}] for one side; `accuracy`: 0-100 or null.
 * Returns {worst: {ply, text} | null, good: string, focus: {skill, label, tip} | null}.
 */
export function coachCard(mistakes, accuracy) {
  const serious = mistakes.filter((m) => SEVERITY[m.kind] >= 2);
  const worst = [...serious].sort((a, b) => SEVERITY[b.kind] - SEVERITY[a.kind] || b.drop - a.drop)[0];
  const tally = {};
  for (const m of serious) if (m.skill in SKILLS) tally[m.skill] = (tally[m.skill] ?? 0) + SEVERITY[m.kind];
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    worst: worst ? { ply: worst.ply, text: `${moveLabel(worst.ply, worst.san)}: ${worst.why}` } : null,
    good: praise(mistakes, accuracy),
    focus: top ? { skill: top, label: SKILLS[top].label, tip: SKILLS[top].tip } : null,
  };
}

function praise(mistakes, accuracy) {
  const blunders = mistakes.some((m) => SEVERITY[m.kind] === 3);
  if (!blunders && accuracy >= 85) return 'A clean, accurate game with no blunders.';
  if (!blunders) return 'No blunders all game.';
  if (!mistakes.some((m) => SEVERITY[m.kind] >= 2 && m.ply < 20)) return 'A clean opening: no mistakes in your first 10 moves.';
  if (accuracy >= 70) return `${accuracy}% accuracy overall. Most of your moves held up.`;
  return 'You played it out to the end, and every mistake here is something to learn from.';
}

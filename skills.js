// The skill profile: one 0-100 score per skill, moved by tagged game mistakes (motifs.js) and puzzle results.
// A score is an exponentially weighted average, so recent play counts most and it never freezes. Pure apart from
// the storage passed in, unit-tested.
const KEY = 'checkmate.skills';
const ALPHA = 0.25; // how far one full-weight result moves a score towards its target
const START = 50;

/** id -> label, Lichess puzzle themes that train it, and a one-line tip. Order is the display order. */
export const SKILLS = {
  hanging: { label: 'Loose pieces', themes: ['hangingPiece'], tip: 'Before each move, check every piece you leave behind: is it still defended?' },
  threats: { label: 'Threat awareness', themes: ['middlegame', 'advantage'], tip: 'After every opponent move, ask what it attacks before making your own plan.' },
  fork: { label: 'Forks', themes: ['fork'], tip: 'Look for squares where one enemy knight or queen would hit two of your pieces.' },
  pin: { label: 'Pins & skewers', themes: ['pin', 'skewer', 'discoveredAttack'], tip: 'Keep pieces off the same line as your king or queen when an enemy bishop, rook or queen can reach it.' },
  mate: { label: 'Checkmate patterns', themes: ['mate'], tip: 'Every move, look at all checks for both sides first.' },
  kingSafety: { label: 'King safety', themes: ['mateIn2', 'mateIn3', 'sacrifice'], tip: 'Castle early and leave the pawns in front of your king where they are.' },
  development: { label: 'Development', themes: ['opening'], tip: 'Get knights and bishops out before moving a piece twice or bringing out the queen.' },
  endgame: { label: 'Endgames', themes: ['endgame'], tip: 'In the endgame, bring your king to the centre and push passed pawns.' },
};

/** Weight of each engine verdict when it pulls a skill towards 0. */
const WEIGHT = { blunder: 1, 'missed-mate': 1, mistake: 0.6, inaccuracy: 0.3 };

/** Profile: {[skill]: {score, n}}; n counts the results that measured that skill. */
export function loadProfile(storage) {
  try {
    const p = JSON.parse(storage.getItem(KEY));
    if (!p || typeof p !== 'object') return {};
    return Object.fromEntries(Object.entries(p).filter(([k, v]) => k in SKILLS && Number.isFinite(v?.score) && Number.isInteger(v?.n)));
  } catch { return {}; }
}

export function saveProfile(storage, profile) {
  try { storage.setItem(KEY, JSON.stringify(profile)); } catch { /* storage disabled: the profile won't persist */ }
}

function nudge(profile, skill, target, weight, counts = true) {
  const s = profile[skill] ?? { score: START, n: 0 };
  const score = Math.round((s.score + ALPHA * weight * (target - s.score)) * 10) / 10;
  return { ...profile, [skill]: { score, n: s.n + (counts ? 1 : 0) } };
}

/**
 * After a game: each tag ({skill, kind}) pulls its skill down by the verdict's weight. Skills already measured
 * that this game didn't trip over drift up a little (without counting as new evidence).
 */
export function recordGame(profile, tags) {
  let out = profile;
  for (const t of tags) if (t.skill in SKILLS) out = nudge(out, t.skill, 0, WEIGHT[t.kind] ?? 0.3);
  const hit = new Set(tags.map((t) => t.skill));
  for (const k of Object.keys(out)) if (!hit.has(k)) out = nudge(out, k, 100, 0.15, false);
  return out;
}

/** Skills a puzzle's Lichess themes exercise. */
export const skillsForThemes = (themes) => Object.keys(SKILLS).filter((k) => SKILLS[k].themes.some((t) => themes.includes(t)));

/** After an unassisted puzzle: solved pulls its skills up, failed pulls them down. */
export function recordPuzzle(profile, themes, solved) {
  return skillsForThemes(themes).reduce((p, k) => nudge(p, k, solved ? 100 : 0, 0.5), profile);
}

/** Measured skills, weakest first: [{skill, label, score, n}]. */
export const ranked = (profile) => Object.entries(profile).filter(([, v]) => v.n > 0)
  .map(([skill, v]) => ({ skill, label: SKILLS[skill].label, score: Math.round(v.score), n: v.n }))
  .sort((a, b) => a.score - b.score || b.n - a.n);

/** The skill to train next, or null before anything has been measured. */
export const weakest = (profile) => ranked(profile)[0]?.skill ?? null;

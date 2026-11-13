// The opponent ladder: eight named computer players, weakest first. Beat the next one to unlock the one above.
// Progress and a local Elo-style rating live in localStorage. Pure functions apart from the storage passed in.
const KEY = 'checkmate.ladder';

/**
 * `level` is what engines.js plays at: 'beginner' (built-in search with noise, below Stockfish's floor),
 * a Stockfish level name, or a number (Stockfish UCI_Elo, 1320-3190). `rating` is what the player's rating is scored against.
 * `style` (styles.js) is how they pick among near-equal moves, so the Tactician actually plays sharp.
 */
export const OPPONENTS = [
  { name: 'Pip the Pawn-pusher', style: 'balanced', level: 'beginner', rating: 700,
    lines: { hello: 'Hi! I just learned how the horsey moves.', capture: 'Yoink!', win: 'I won? I won! Wait till I tell my mum.', lose: 'Good game! You were way too clever for me.' } },
  { name: 'Aunt Mabel', style: 'defensive', level: 'easy', rating: 1000,
    lines: { hello: 'Tea first, then chess, dear.', capture: 'Oh, I\'ll just take that.', win: 'Never underestimate a woman with knitting needles.', lose: 'Well played, dear. Have a biscuit.' } },
  { name: 'Rookie Rex', style: 'aggressive', level: 1350, rating: 1350,
    lines: { hello: 'Rooks are the best piece. Fight me.', capture: 'Crushed it!', win: 'Rex reigns!', lose: 'Rematch. Right now. Please.' } },
  { name: 'Professor Fianchetto', style: 'positional', level: 1600, rating: 1600,
    lines: { hello: 'Let us study this position together.', capture: 'A textbook capture.', win: 'Class dismissed.', lose: 'Fascinating. I shall revise my notes.' } },
  { name: 'Coach Kasia', style: 'balanced', level: 1850, rating: 1850,
    lines: { hello: 'Centre, development, king safety. Show me.', capture: 'Loose pieces drop off.', win: 'Drill your tactics and come back.', lose: 'That is exactly how I taught it. Bravo.' } },
  { name: 'The Tactician', style: 'tactical', level: 2100, rating: 2100,
    lines: { hello: 'Every piece is a target.', capture: 'Did you see that coming?', win: 'Combination complete.', lose: 'You out-calculated me. Rare.' } },
  { name: 'The Iron Duke', style: 'defensive', level: 2450, rating: 2450,
    lines: { hello: 'I do not lose. I wait.', capture: 'Inevitable.', win: 'Steel bends nothing.', lose: 'Impossible. Impressive.' } },
  { name: 'The Grandmaster', style: 'balanced', level: 'master', rating: 2850,
    lines: { hello: 'Welcome to the top. Few arrive.', capture: 'Precisely.', win: 'Come back when you see further.', lose: 'You have beaten the ladder. Remarkable.' } },
];

const FRESH = { rung: 0, rating: 800, games: 0, beaten: 0 };

/** Ladder progress: {rung (index of the next opponent), rating, games, beaten (count)}. */
export function loadLadder(storage) {
  try {
    const s = JSON.parse(storage.getItem(KEY));
    if (!s || !Number.isInteger(s.rung) || !Number.isFinite(s.rating)) return { ...FRESH };
    return { ...FRESH, ...s, rung: Math.min(Math.max(0, s.rung), OPPONENTS.length - 1) };
  } catch { return { ...FRESH }; }
}

export function saveLadder(storage, state) {
  try { storage.setItem(KEY, JSON.stringify(state)); } catch { /* storage disabled: progress won't persist */ }
}

/** Chance of scoring against an opponent rated `opp` (standard Elo curve). */
export const expected = (me, opp) => 1 / (1 + 10 ** ((opp - me) / 400));

/** New state after a game against the current rung; `score` is 1 win, 0.5 draw, 0 loss. */
export function recordResult(state, score) {
  const opp = OPPONENTS[state.rung];
  const K = state.games < 10 ? 48 : 24; // move fast while the rating is still a guess
  const rating = Math.round(state.rating + K * (score - expected(state.rating, opp.rating)));
  const won = score === 1;
  const top = state.rung === OPPONENTS.length - 1;
  return {
    rung: won && !top ? state.rung + 1 : state.rung,
    rating: Math.max(100, rating),
    games: state.games + 1,
    beaten: won ? Math.max(state.beaten, state.rung + 1) : state.beaten,
  };
}

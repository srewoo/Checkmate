// Computer opponent: a small alpha-beta search, optionally steered by Chrome's built-in AI (Gemini Nano).
import { Chess } from './vendor/chess.js';

const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 100000;
const LEVELS = { easy: { depth: 1, pool: 0 }, medium: { depth: 2, pool: 5 }, hard: { depth: 3, pool: 3 } };

// Centralisation bonus (0 in corners, ~12 in the middle), cheap stand-in for piece-square tables.
const center = (sq) => {
  const f = sq.charCodeAt(0) - 97;
  const r = sq.charCodeAt(1) - 49;
  return (3.5 - Math.abs(3.5 - f)) * (3.5 - Math.abs(3.5 - r));
};

function evaluate(ch) {
  let score = 0;
  for (const row of ch.board()) {
    for (const p of row) {
      if (!p) continue;
      let v = VALUE[p.type];
      if (p.type === 'n' || p.type === 'b' || p.type === 'p') v += center(p.square) * 4;
      if (p.type === 'p') v += (p.color === 'w' ? +p.square[1] - 2 : 7 - +p.square[1]) * 6;
      score += p.color === 'w' ? v : -v;
    }
  }
  return ch.turn() === 'w' ? score : -score;
}

const order = (moves) => moves.sort((a, b) => (VALUE[b.captured] ?? -1) - (VALUE[a.captured] ?? -1));
const play = (ch, m) => ch.move({ from: m.from, to: m.to, promotion: m.promotion });

function negamax(ch, depth, alpha, beta, ply) {
  const moves = ch.moves({ verbose: true });
  if (!moves.length) return ch.inCheck() ? -MATE + ply : 0;
  if (ch.isDraw()) return 0;
  if (depth === 0) return evaluate(ch);
  for (const m of order(moves)) {
    play(ch, m);
    const s = -negamax(ch, depth - 1, -beta, -alpha, ply + 1);
    ch.undo();
    if (s >= beta) return beta;
    if (s > alpha) alpha = s;
  }
  return alpha;
}

/** Every legal root move with a score, best first. */
export function rankMoves(fen, depth) {
  const ch = new Chess(fen);
  const scored = order(ch.moves({ verbose: true })).map((m) => {
    play(ch, m);
    const score = -negamax(ch, depth - 1, -MATE - 1, MATE + 1, 1);
    ch.undo();
    return { move: m, score };
  });
  // shuffle first so equal-score moves vary between games instead of always picking the first generated
  return scored.map((s) => [Math.random(), s]).sort((a, b) => a[0] - b[0]).map(([, s]) => s).sort((a, b) => b.score - a.score);
}

/** Classic engine. Easy adds noise so it blunders like a beginner. */
export function classicMove(fen, level) {
  const { depth } = LEVELS[level] ?? LEVELS.medium;
  const ranked = rankMoves(fen, depth);
  if (level === 'easy') {
    for (const r of ranked) r.score += Math.random() * 250;
    ranked.sort((a, b) => b.score - a.score);
  }
  return ranked[0]?.move;
}

/** SAN pool Chrome AI may choose from: the search pre-filters by difficulty (easy = any legal move). */
export function candidates(fen, level) {
  const { depth, pool } = LEVELS[level] ?? LEVELS.medium;
  const ranked = rankMoves(fen, depth).map((r) => r.move.san);
  return pool ? ranked.slice(0, pool) : ranked;
}

// ---- Chrome built-in AI (Prompt API) ----

const LM_OPTS = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};
let base;

export async function chromeAIStatus() {
  if (!('LanguageModel' in self)) return 'unavailable';
  try { return await self.LanguageModel.availability(LM_OPTS); } catch { return 'unavailable'; }
}

/** Must be called from a user gesture the first time (it may trigger the model download). */
export async function warmChromeAI(onProgress) {
  base ??= await self.LanguageModel.create({
    ...LM_OPTS,
    initialPrompts: [{ role: 'system', content: 'You are a concise chess assistant. Always answer with the requested JSON.' }],
    monitor(m) { m.addEventListener('downloadprogress', (e) => onProgress?.(e.loaded)); },
  });
  return base;
}

async function ask(prompt, schema) {
  const s = await (await warmChromeAI()).clone();
  try { return JSON.parse(await s.prompt(prompt, { responseConstraint: schema })); } finally { s.destroy(); }
}

/**
 * Nano picks from `sans` (see candidates()), so its answer is always legal and the
 * difficulty level still means something. Returns {san, comment}.
 */
export async function chromeAIMove(fen, sans, pgn) {
  const out = await ask(
    `Position (FEN): ${fen}\nGame so far: ${pgn || '(start)'}\nChoose your move from: ${sans.join(', ')}.\n` +
      'Reply as JSON {"move": <one of the options>, "comment": <one short sentence why>}.',
    { type: 'object', properties: { move: { type: 'string', enum: sans }, comment: { type: 'string' } }, required: ['move', 'comment'] },
  );
  return { san: sans.includes(out.move) ? out.move : sans[0], comment: String(out.comment ?? '').slice(0, 160) };
}

/** Fallback when the regex parser can't place a spoken phrase. Returns a SAN or null. */
export async function chromeAIInterpret(text, legalSans) {
  const out = await ask(
    `A chess player said: "${text}". Legal moves: ${legalSans.join(', ')}. Which move did they mean? Use "none" if unclear.`,
    { type: 'object', properties: { move: { type: 'string', enum: [...legalSans, 'none'] } }, required: ['move'] },
  );
  return out.move === 'none' ? null : out.move;
}

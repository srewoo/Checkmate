// Stockfish 17.1 (lite, single-threaded WASM) as a UCI worker. Levels use Stockfish's own strength limiter.
export const SF_LEVELS = {
  easy: { opts: { UCI_LimitStrength: false, 'Skill Level': 0 }, movetime: 150 },
  medium: { opts: { UCI_LimitStrength: true, UCI_Elo: 1500 }, movetime: 400 },
  hard: { opts: { UCI_LimitStrength: true, UCI_Elo: 2100 }, movetime: 800 },
  master: { opts: { UCI_LimitStrength: false, 'Skill Level': 20 }, movetime: 1500 },
};

/** UCI lines for one search. Every option is resent so switching level mid-session can't leave a stale limit. */
/** `level` is a name in SF_LEVELS or a number: a target Elo (ladder opponents), clamped to Stockfish's 1320-3190. */
/** `multipv` > 1 asks for that many candidate lines (see parseInfo). */
export function goCommands(fen, level, movetime, multipv = 1) {
  const sf = typeof level === 'number'
    ? { opts: { UCI_LimitStrength: true, UCI_Elo: Math.round(Math.min(3190, Math.max(1320, level))) }, movetime: level < 2000 ? 500 : 900 }
    : SF_LEVELS[level] ?? SF_LEVELS.medium;
  const opts = { ...sf.opts, MultiPV: multipv };
  return [...Object.entries(opts).map(([k, v]) => `setoption name ${k} value ${v}`), `position fen ${fen}`, `go movetime ${movetime ?? sf.movetime}`];
}

/** "info ... score cp -35 ..." -> centipawns for the side to move; mates are ±100000. null if no score. */
export function parseScore(line) {
  const m = / score (cp|mate) (-?\d+)/.exec(line);
  if (!m) return null;
  return m[1] === 'cp' ? +m[2] : Math.sign(+m[2] || -1) * 100000;
}

/** "info ... multipv 2 score cp -14 ... pv d2d4 ..." -> {multipv, score, uci}; null for lines without a pv. */
export function parseInfo(line) {
  const score = parseScore(line);
  const pv = / pv ([a-h][1-8][a-h][1-8][qrbn]?)/.exec(line);
  if (score === null || !pv) return null;
  return { multipv: +(/ multipv (\d+)/.exec(line)?.[1] ?? 1), score, uci: pv[1] };
}

/** "bestmove e7e8q ponder ..." -> {from, to, promotion}; null when there is no legal move. */
export function parseBestMove(line) {
  const m = /^bestmove ([a-h][1-8])([a-h][1-8])([qrbn])?/.exec(line);
  return m ? { from: m[1], to: m[2], promotion: m[3] } : null;
}

export function createStockfish(url) {
  const worker = new Worker(url);
  let waiter = null;
  let score = null;
  let lines = new Map(); // multipv index -> latest {score, uci}
  const fail = (err) => { const w = waiter; waiter = null; w?.reject(err); };
  worker.onmessage = ({ data }) => {
    const info = String(data).startsWith('info') ? parseInfo(String(data)) : null;
    if (info) { lines.set(info.multipv, info); if (info.multipv === 1) score = info.score; }
    if (waiter && String(data).startsWith(waiter.prefix)) { const w = waiter; waiter = null; w.resolve(String(data)); }
  };
  worker.onerror = (e) => { e.preventDefault(); fail(new Error(`Stockfish worker error: ${e.message}`)); };
  const until = (prefix, ms) => new Promise((resolve, reject) => {
    waiter = { prefix, resolve, reject };
    setTimeout(() => { if (waiter?.resolve === resolve) fail(new Error(`Stockfish: no "${prefix}" within ${ms} ms`)); }, ms);
  });

  worker.postMessage('uci');
  const init = until('uciok', 15000);
  let queue = init.catch(() => {});
  const go = (cmds) => {
    const run = queue.then(() => init).then(async () => {
      score = null;
      lines = new Map();
      for (const c of cmds) worker.postMessage(c);
      const move = parseBestMove(await until('bestmove', 15000));
      return { move, score, lines: [...lines.values()].map(({ uci, score: s }) => ({ uci, score: s })) };
    });
    queue = run.catch(() => {}); // ponytail: searches run one at a time; the game asks once per move
    return run;
  };
  return {
    /** Resolves to a chess.js move input, or null if the side to move has no legal move. */
    bestMove: async (fen, level) => (await go(goCommands(fen, level))).move,
    /** {move, lines}: the strength-limited choice plus up to 4 candidate lines [{uci, score}] to choose a style from. */
    candidates: async (fen, level) => go(goCommands(fen, level, undefined, 4)),
    /** Full-strength score in centipawns for the side to move. */
    evaluate: async (fen, movetime = 400) => (await go(goCommands(fen, 'master', movetime))).score,
  };
}

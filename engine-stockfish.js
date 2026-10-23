// Stockfish 17.1 (lite, single-threaded WASM) as a UCI worker. Levels use Stockfish's own strength limiter.
export const SF_LEVELS = {
  easy: { opts: { UCI_LimitStrength: false, 'Skill Level': 0 }, movetime: 150 },
  medium: { opts: { UCI_LimitStrength: true, UCI_Elo: 1500 }, movetime: 400 },
  hard: { opts: { UCI_LimitStrength: true, UCI_Elo: 2100 }, movetime: 800 },
  master: { opts: { UCI_LimitStrength: false, 'Skill Level': 20 }, movetime: 1500 },
};

/** UCI lines for one search. Every option is resent so switching level mid-session can't leave a stale limit. */
export function goCommands(fen, level, movetime) {
  const sf = SF_LEVELS[level] ?? SF_LEVELS.medium;
  return [...Object.entries(sf.opts).map(([k, v]) => `setoption name ${k} value ${v}`), `position fen ${fen}`, `go movetime ${movetime ?? sf.movetime}`];
}

/** "info ... score cp -35 ..." -> centipawns for the side to move; mates are ±100000. null if no score. */
export function parseScore(line) {
  const m = / score (cp|mate) (-?\d+)/.exec(line);
  if (!m) return null;
  return m[1] === 'cp' ? +m[2] : Math.sign(+m[2] || -1) * 100000;
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
  const fail = (err) => { const w = waiter; waiter = null; w?.reject(err); };
  worker.onmessage = ({ data }) => {
    if (String(data).startsWith('info') && String(data).includes(' score ')) score = parseScore(String(data));
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
      for (const c of cmds) worker.postMessage(c);
      return { move: parseBestMove(await until('bestmove', 15000)), score };
    });
    queue = run.catch(() => {}); // ponytail: searches run one at a time; the game asks once per move
    return run;
  };
  return {
    /** Resolves to a chess.js move input, or null if the side to move has no legal move. */
    bestMove: async (fen, level) => (await go(goCommands(fen, level))).move,
    /** Full-strength score in centipawns for the side to move. */
    evaluate: async (fen) => (await go(goCommands(fen, 'master', 400))).score,
  };
}

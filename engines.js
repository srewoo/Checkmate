// Computer moves: Stockfish, with the built-in search worker as fallback (and as Chrome AI's candidate source).
import { createStockfish } from './engine-stockfish.js';

const stockfish = createStockfish('vendor/stockfish/stockfish.js');
const worker = new Worker('engine-worker.js', { type: 'module' });

/** Built-in search. In: {fen, level, pool}. Out: {fen, san} or {fen, sans}. */
export const search = (msg) => new Promise((resolve) => {
  const h = (e) => {
    if (e.data.fen !== msg.fen) return;
    worker.removeEventListener('message', h);
    resolve(e.data);
  };
  worker.addEventListener('message', h);
  worker.postMessage(msg);
});

/** Stockfish's score for the side to move (centipawns), or null if Stockfish is unavailable. */
export const evaluate = (fen) => stockfish.evaluate(fen).catch(() => null);

/** A chess.js move input for the side to move. */
export async function engineMove(fen, level) {
  try {
    const m = await stockfish.bestMove(fen, level);
    if (m) return m;
  } catch (err) { console.warn('[checkmate] Stockfish failed, using classic engine:', err); }
  return (await search({ fen, level })).san;
}

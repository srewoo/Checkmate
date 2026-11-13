// Computer moves: Stockfish, with the built-in search worker as fallback (and as Chrome AI's candidate source).
import { createStockfish } from './engine-stockfish.js';
import { pickStyled, STYLES } from './styles.js';

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
export const evaluate = (fen, movetime) => stockfish.evaluate(fen, movetime).catch(() => null);

const uciOf = (m) => m.from + m.to + (m.promotion ?? '');
const fromUci = (u) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });

/** A chess.js move input for the side to move. `style` (styles.js) flavours the choice among near-equal moves. */
export async function engineMove(fen, level, style = 'balanced') {
  if (level === 'beginner') return (await search({ fen, level: 'easy' })).san; // weaker than Stockfish's floor
  try {
    if (STYLES[style]) {
      const { move, lines } = await stockfish.candidates(fen, level);
      if (move) return fromUci(pickStyled(lines, uciOf(move), fen, style));
    }
    const m = await stockfish.bestMove(fen, level);
    if (m) return m;
  } catch (err) { console.warn('[checkmate] Stockfish failed, using classic engine:', err); }
  return (await search({ fen, level })).san;
}

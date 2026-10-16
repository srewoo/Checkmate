// Runs the search off the UI thread. In: {fen, level, pool}. Out: {fen, san} or {fen, sans}.
import { classicMove, candidates } from './ai.js';

self.onmessage = ({ data: { fen, level, pool } }) => {
  self.postMessage(pool ? { fen, sans: candidates(fen, level) } : { fen, san: classicMove(fen, level)?.san });
};

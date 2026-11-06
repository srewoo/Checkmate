// Live coaching vs the computer: Stockfish scores each of your moves and the game reacts ("Great move!",
// "Blunder") with a toast and a 3D effect; an optional evaluation bar shows who is winning.
import { evaluate } from './engines.js';
import { classify, winChance } from './analysis.js';
import { toast } from './toast.js';
import { g, $, on, emit, isOver, vsComputer } from './state.js';

const LABEL = {
  great: '!! Great move', good: 'Good move', inaccuracy: '?! Inaccuracy', mistake: '? Mistake', blunder: '?? Blunder',
  'missed-mate': 'You missed a mate',
};
const wanted = () => vsComputer() && (g.settings.react || g.settings.evalBar);

// fen -> Promise<score for the side to move>; small, because only the last few positions are ever asked again
const scores = new Map();
function scoreOf(fen) {
  if (!scores.has(fen)) {
    scores.set(fen, evaluate(fen, 300));
    if (scores.size > 16) scores.delete(scores.keys().next().value);
  }
  return scores.get(fen);
}

function setBar(fen, s) {
  const bar = $('evalBar');
  bar.hidden = !(vsComputer() && g.settings.evalBar);
  if (bar.hidden || s === null || fen !== g.chess.fen()) return;
  const white = fen.split(' ')[1] === 'w' ? s : -s;
  bar.style.setProperty('--w', `${winChance(white).toFixed(1)}%`);
  const text = Math.abs(white) >= 100000 ? `${white > 0 ? 'White' : 'Black'} has a forced mate` : `${white >= 0 ? '+' : ''}${(white / 100).toFixed(1)}`;
  bar.title = text;
  bar.setAttribute('aria-label', `Evaluation ${text}`);
}

// your turn: score the position now, so your move can be judged against it
on('update', () => {
  if (!wanted()) { $('evalBar').hidden = true; return; }
  const fen = g.chess.fen();
  if (g.review === null && !isOver() && g.chess.turn() === g.myColor) scoreOf(fen).then((s) => setBar(fen, s));
});

on('move', async ({ m, by, before }) => {
  if (!wanted() || by !== 'human') return;
  const gid = g.gameId;
  const pAfter = scoreOf(m.after); // queued now, ahead of the computer's reply, so the reaction lands first
  const [sBefore, sAfter] = await Promise.all([scoreOf(before), pAfter]);
  if (gid !== g.gameId || sBefore === null || sAfter === null) return;
  setBar(m.after, sAfter);
  if (!g.settings.react) return;
  const { kind } = classify(sBefore, sAfter, { capture: Boolean(m.captured), check: /[+#]/.test(m.san) });
  if (!kind) return;
  toast(LABEL[kind], kind);
  g.board3d?.react(kind, m.to);
  emit('reaction', { kind, m });
});

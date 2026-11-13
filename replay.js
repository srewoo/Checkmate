// Review and replay: click a move (or use ←/→, Home/End) to see that position; "Watch replay" on the result card
// animates the whole game; the result card also gets an accuracy summary per side from Stockfish, and the coach card.
import { evaluate } from './engines.js';
import { summarize } from './analysis.js';
import { renderCoach } from './report.js';
import { update } from './hud.js';
import { g, $, on, emit, sideName } from './state.js';

const total = () => g.chess.history().length;
function show(ply) {
  g.review = ply === null || ply >= total() ? null : Math.max(0, ply);
  update();
}

$('moves').addEventListener('click', (e) => {
  const ply = e.target.closest('[data-ply]')?.dataset.ply;
  if (ply) show(Number(ply));
});

document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.target.closest?.('input, textarea, dialog, #board3d') || !total() || g.settings.mode === 'puzzle') return;
  const cur = g.review ?? total();
  const to = { ArrowLeft: cur - 1, ArrowRight: cur + 1, Home: 0, End: null }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  show(to);
});

/** Plays the game back from the start, one move a second; any board click stops it. */
async function replay() {
  const gid = g.gameId;
  for (let ply = 0; ply <= total(); ply++) {
    if (gid !== g.gameId || (ply > 0 && g.review !== ply - 1)) return; // a new game, or the player clicked
    show(ply);
    await new Promise((r) => setTimeout(r, ply ? 1000 : 1400));
  }
  g.board3d?.home();
}
$('replayBtn').addEventListener('click', () => { $('result').close(); replay(); });

/**
 * Scores every position (fast, 80 ms each) and writes accuracy + error counts per side onto the result card. For
 * the player's own game (vs the computer, or a reviewed PGN) it adds the coach card and updates the skill profile.
 */
export async function analyse() {
  const gid = g.gameId;
  const moves = g.chess.history({ verbose: true });
  const out = $('resultSummary');
  const fens = moves.length ? [moves[0].before, ...moves.map((m) => m.after)] : [];
  const scores = [];
  for (let i = 0; i < fens.length; i++) {
    if (gid !== g.gameId) return; // stop at once if a new game wants the engine
    if (i % 8 === 0) out.textContent = `Analysing… ${Math.round((100 * i) / fens.length)}%`;
    scores.push(await evaluate(fens[i], 80));
  }
  if (gid !== g.gameId) return;
  if (scores.includes(null)) { out.textContent = ''; return; }
  const side = (color) => summarize(moves.map((_, i) => [scores[i], scores[i + 1]]).filter((_, i) => (i % 2 === 0) === (color === 'w')));
  const sides = { w: side('w'), b: side('b') };
  const me = g.myColor ?? g.reviewSide;
  const name = (color) => (me === null ? sideName(color) : color === me ? 'You' : g.reviewSide ? sideName(color) : g.opponent);
  const line = (color) => {
    const { accuracy, counts } = sides[color];
    const errs = [['blunder', counts.blunder], ['mistake', counts.mistake], ['inaccuracy', counts.inaccuracy]]
      .filter(([, n]) => n).map(([k, n]) => `${n} ${k}${n > 1 ? 's' : ''}`).join(', ');
    return `<li><b>${name(color)}</b> ${accuracy ?? '–'}% accuracy${errs ? ` · ${errs}` : ''}</li>`;
  };
  out.innerHTML = `<ul>${line('w')}${line('b')}</ul>`; // only numbers, fixed words and names from our own code
  emit('summary', sides);
  if (me && (g.settings.mode === 'ai' || g.reviewSide)) {
    renderCoach(moves, scores, me, sides[me].accuracy, (ply) => { $('result').close(); show(ply); });
  }
}

on('gameover', () => {
  $('replayBtn').hidden = total() < 2;
  if (total() >= 6 && g.settings.mode !== 'online') analyse();
});

// Review and replay: click a move (or use ←/→, Home/End) to see that position; "Watch replay" on the result card
// animates the whole game; the result card also gets an accuracy summary per side from Stockfish.
import { Chess } from './vendor/chess.js';
import { evaluate } from './engines.js';
import { summarize } from './analysis.js';
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

/** Scores every position (fast, 80 ms each) and writes accuracy + error counts per side onto the result card. */
async function analyse() {
  const gid = g.gameId;
  const sans = g.chess.history();
  const out = $('resultSummary');
  const c = new Chess();
  const scores = [];
  for (let i = 0; i <= sans.length; i++) {
    if (gid !== g.gameId) return; // stop at once if a new game wants the engine
    if (i % 8 === 0) out.textContent = `Analysing… ${Math.round((100 * i) / (sans.length + 1))}%`;
    scores.push(await evaluate(c.fen(), 80));
    if (i < sans.length) c.move(sans[i]);
  }
  if (gid !== g.gameId) return;
  if (scores.includes(null)) { out.textContent = ''; return; }
  const side = (color) => summarize(sans.map((_, i) => [scores[i], scores[i + 1]]).filter((_, i) => (i % 2 === 0) === (color === 'w')));
  const sides = { w: side('w'), b: side('b') };
  const name = (color) => (g.myColor === null ? sideName(color) : color === g.myColor ? 'You' : g.opponent);
  const line = (color) => {
    const { accuracy, counts } = sides[color];
    const errs = [['blunder', counts.blunder], ['mistake', counts.mistake], ['inaccuracy', counts.inaccuracy]]
      .filter(([, n]) => n).map(([k, n]) => `${n} ${k}${n > 1 ? 's' : ''}`).join(', ');
    return `<li><b>${name(color)}</b> ${accuracy ?? '–'}% accuracy${errs ? ` · ${errs}` : ''}</li>`;
  };
  out.innerHTML = `<ul>${line('w')}${line('b')}</ul>`; // only numbers, fixed words and names from our own code
  emit('summary', sides);
}

on('gameover', () => {
  $('replayBtn').hidden = total() < 2;
  if (total() >= 6 && g.settings.mode !== 'online') analyse();
});

// Puzzle mode: Practice (rated, endless), Daily (one a day, with a streak) and Puzzle Rush (3 minutes, 3 strikes,
// getting harder). The opponent's moves are played from the puzzle's solution; the player's are judged.
import { daily, near, judge, fromUci, rushRating } from './puzzles.js';
import { expected } from './ladder.js';
import { toast } from './toast.js';
import { showResult } from './dialogs.js';
import { commit } from './play.js';
import { update } from './hud.js';
import { g, $, heard, on, emit, sideName } from './state.js';

const KEY = 'checkmate.puzzles';
const RUSH_MS = 180000;
const STRIKES = 3;
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

function loadStats() {
  try { return { rating: 1000, solved: 0, bestRush: 0, dailyDate: null, dailyStreak: 0, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { rating: 1000, solved: 0, bestRush: 0, dailyDate: null, dailyStreak: 0 }; }
}
const stats = loadStats();
const saveStats = () => { try { localStorage.setItem(KEY, JSON.stringify(stats)); } catch { /* not persisted */ } };
export const puzzleStats = () => stats;

let cur = null; // {p, ply, failed, hints}
let run = null; // Puzzle Rush: {score, strikes, ends, timer}
const seen = new Set();
const kind = () => g.settings.pz;
const later = (ms, fn) => { const gid = g.gameId; setTimeout(() => { if (gid === g.gameId && g.settings.mode === 'puzzle') fn(); }, ms); };

function setStatus() {
  if (!cur) return;
  const side = sideName(g.myColor);
  if (run) {
    const left = Math.max(0, run.ends - Date.now());
    const t = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
    g.status = `Rush ${t} · ${run.score} solved · ${'✗'.repeat(run.strikes)}${'○'.repeat(STRIKES - run.strikes)}`;
  } else if (kind() === 'daily') g.status = `Daily puzzle · ${side} to play${stats.dailyStreak ? ` · streak ${stats.dailyStreak}` : ''}`;
  else g.status = `Puzzle ${cur.p.rating} · ${side} to play · your rating ${stats.rating}`;
  $('status').textContent = g.status;
}

function pick() {
  if (kind() === 'daily') return daily(new Date());
  return near(run ? rushRating(run.score) : stats.rating, seen);
}

function load() {
  const p = pick();
  seen.add(p.id);
  if (seen.size > 300) seen.delete(seen.values().next().value);
  g.chess.load(p.fen);
  g.myColor = g.chess.turn() === 'w' ? 'b' : 'w'; // the setup move is the opponent's
  g.view.flipped = g.myColor === 'b';
  g.view.last = undefined;
  cur = { p, ply: 1, failed: false, hints: g.hintsUsed };
  g.hintMove = () => fromUci(cur.p.moves[cur.ply]);
  g.busy = true;
  setStatus();
  heard(`Find the best move for ${sideName(g.myColor)}.`);
  later(700, () => { g.busy = false; commit(fromUci(p.moves[0]), 'puzzle'); setStatus(); });
}

function startRun() {
  clearInterval(run?.timer);
  run = { score: 0, strikes: 0, ends: Date.now() + RUSH_MS };
  run.timer = setInterval(() => { setStatus(); if (Date.now() >= run.ends) endRun('Time!'); }, 250);
}

function endRun(why) {
  if (!run) return;
  clearInterval(run.timer);
  const { score } = run;
  const best = score > stats.bestRush;
  stats.bestRush = Math.max(stats.bestRush, score);
  saveStats();
  run = null;
  g.busy = true; // board frozen until the next run starts
  emit('rush-over', { score });
  showResult(`Puzzle Rush: ${score}`, `${why} ${best ? 'New personal best!' : `Best: ${stats.bestRush}`}`, '', () => emit('rematch'));
}

function rate(won) {
  const p = cur.p;
  const assisted = g.hintsUsed > cur.hints;
  if (kind() !== 'practice' || (won && assisted)) return '';
  const before = stats.rating;
  stats.rating = Math.max(400, Math.round(stats.rating + 32 * ((won ? 1 : 0) - expected(stats.rating, p.rating))));
  return ` · rating ${before} → ${stats.rating}`;
}

function solved(m) {
  const assisted = g.hintsUsed > cur.hints;
  stats.solved++;
  let extra = '';
  if (!cur.failed) extra = rate(true);
  if (kind() === 'daily' && stats.dailyDate !== today()) {
    const yesterday = new Date(Date.now() - 864e5).toLocaleDateString('en-CA');
    stats.dailyStreak = stats.dailyDate === yesterday ? stats.dailyStreak + 1 : 1;
    stats.dailyDate = today();
    extra = ` · daily streak ${stats.dailyStreak}`;
  }
  if (run && !assisted) run.score++;
  saveStats();
  toast(`✓ Solved!${extra}`, 'great');
  g.board3d?.react('great', m.to);
  emit('puzzle-solved', { puzzle: cur.p, assisted, failed: cur.failed });
  setStatus();
  if (kind() === 'daily') { g.busy = true; heard(`Solved! Come back tomorrow for a new one, or switch to Practice or Puzzle Rush.`); return; }
  later(run ? 600 : 1400, load);
}

function wrong(m) {
  toast('✗ Not the move', 'mistake');
  g.board3d?.react('mistake', m.to);
  if (!cur.failed) { cur.failed = true; const r = rate(false); if (r) heard(`Not quite${r}. Try again.`); saveStats(); }
  g.busy = true;
  later(650, () => {
    g.chess.undo();
    g.view.last = g.chess.history({ verbose: true }).at(-1);
    g.busy = false;
    if (run) {
      run.strikes++;
      if (run.strikes >= STRIKES) return endRun('Three strikes.');
      return load(); // Rush moves on after a miss
    }
    update();
    setStatus();
  });
}

on('newgame', () => {
  if (g.settings.mode !== 'puzzle' || kind() !== 'rush') { clearInterval(run?.timer); run = null; }
  if (g.settings.mode !== 'puzzle') { cur = null; return; }
  if (kind() === 'rush' && !run) startRun();
  else if (run && cur) { run.strikes++; if (run.strikes >= STRIKES) return endRun('Three strikes.'); } // "Next puzzle" mid-rush is a skip
  load();
});

on('move', ({ m, by }) => {
  if (g.settings.mode !== 'puzzle' || !cur || by !== 'human') return;
  const verdict = judge(cur.p, cur.ply, m, g.chess.isCheckmate());
  if (verdict === 'wrong') return wrong(m);
  if (verdict === 'solved') return solved(m);
  cur.ply += 2;
  g.busy = true;
  later(450, () => { g.busy = false; commit(fromUci(cur.p.moves[cur.ply - 1]), 'puzzle'); setStatus(); });
});

on('update', () => { if (g.settings.mode === 'puzzle') setStatus(); });

// Feeds game events into achievements.js, toasts new unlocks, and renders the list in the settings dialog.
import { ACHIEVEMENTS, check, loadUnlocked, saveUnlocked } from './achievements.js';
import { OPPONENTS } from './ladder.js';
import { ladderState } from './ladder-ui.js';
import { puzzleStats } from './puzzle-mode.js';
import { toast } from './toast.js';
import { g, $, on, vsComputer } from './state.js';

const unlocked = loadUnlocked(localStorage);

function feed(event, ctx) {
  const fresh = check(event, ctx, unlocked);
  if (!fresh.length) return;
  for (const id of fresh) { unlocked.add(id); toast(`🏆 ${ACHIEVEMENTS[id].name}`, 'trophy', 2800); }
  saveUnlocked(localStorage, unlocked);
  renderAchievements();
}

/** The trophy list in the settings dialog. Names and descriptions are our own constants. */
export function renderAchievements() {
  const ids = Object.keys(ACHIEVEMENTS);
  $('trophyCount').textContent = `${ids.filter((id) => unlocked.has(id)).length}/${ids.length}`;
  $('trophies').innerHTML = ids.map((id) => {
    const a = ACHIEVEMENTS[id];
    return `<li class="${unlocked.has(id) ? 'got' : ''}"><b>${a.name}</b> <span>${a.how}</span></li>`;
  }).join('');
}

on('gameover', ({ r }) => {
  if (!vsComputer() || r.winner !== g.myColor) return;
  const last = g.chess.history({ verbose: true }).at(-1);
  const mateBy = g.chess.isCheckmate() && last ? last.piece : null;
  feed('win', { level: g.settings.level, hints: g.hintsUsed, plies: g.chess.history().length, mateBy });
  if (g.settings.level === 'ladder') feed('ladder', { beaten: ladderState().beaten, total: OPPONENTS.length });
});
on('reaction', ({ kind }) => feed('reaction', { kind }));
on('summary', (sides) => { if (vsComputer() && g.myColor) feed('summary', { accuracy: sides[g.myColor].accuracy, hints: g.hintsUsed }); });
on('puzzle-solved', () => {
  feed('puzzle', { solved: puzzleStats().solved });
  if (g.settings.pz === 'daily') feed('daily', { streak: puzzleStats().dailyStreak });
});
on('rush-over', ({ score }) => feed('rush', { score }));

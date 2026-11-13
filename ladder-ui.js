// Wires the opponent ladder into play: which engine level to use, the opponent's name and voice lines, and
// recording results. Only active when Difficulty is "Opponent ladder".
import { OPPONENTS, loadLadder, saveLadder, recordResult } from './ladder.js';
import { speak } from './voice.js';
import { g, $, heard, on } from './state.js';

let ladder = loadLadder(localStorage);
const active = () => g.settings.mode === 'ai' && g.settings.level === 'ladder';
const current = () => OPPONENTS[ladder.rung];

/** What engines.js should play at for the current settings. */
export const aiLevel = (settings) => (settings.mode === 'ai' && settings.level === 'ladder' ? current().level : settings.level);
/** The playing style (styles.js): the ladder opponent's own, else the one chosen in settings. */
export const aiStyle = (settings) => (settings.mode === 'ai' && settings.level === 'ladder' ? current().style : settings.style);

function say(line) {
  heard(`${current().name}: “${line}”`);
  if (g.settings.speak) speak(line);
}

/** Ladder summary for the settings dialog. */
export function renderLadderInfo() {
  const o = current();
  const done = ladder.beaten >= OPPONENTS.length;
  $('ladderInfo').textContent = `${done ? 'Ladder complete! Rematch the' : 'Next opponent:'} ${o.name} (${o.rating}) · ` +
    `your rating ${ladder.rating} · ${Math.min(ladder.beaten, OPPONENTS.length)}/${OPPONENTS.length} beaten`;
}

on('newgame', ({ resumed }) => {
  g.opponent = active() ? current().name : 'Computer';
  if (active() && !resumed) setTimeout(() => say(current().lines.hello), 400); // after the move-announce of a reset
});

// the opponent gloats a little when it wins material worth a minor piece or more
on('move', ({ m, by }) => {
  if (active() && by === 'computer' && m.captured && m.captured !== 'p') setTimeout(() => say(current().lines.capture), 600);
});

on('gameover', ({ r }) => {
  if (!active()) return;
  const o = current();
  const score = r.winner === null ? 0.5 : r.winner === g.myColor ? 1 : 0;
  const before = ladder.rating;
  ladder = recordResult(ladder, score);
  saveLadder(localStorage, ladder);
  say(score === 1 ? o.lines.lose : score === 0 ? o.lines.win : 'A draw. Honour is shared.');
  const next = ladder.rung !== OPPONENTS.indexOf(o) ? ` · Unlocked: ${current().name}!` : '';
  $('resultExtra').textContent = `${o.name} · rating ${before} → ${ladder.rating}${next}`;
  renderLadderInfo();
});

/** Read-only view for achievements. */
export const ladderState = () => ladder;

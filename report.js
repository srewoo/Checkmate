// The coach card on the result screen (see coachcard.js): records the game's tagged mistakes in the skill
// profile, shows the worst moment with a jump to it, praise and a focus, speaks the focus, and lets Chrome AI
// (when it's ready) add one sentence in its own words. Its facts come only from the engine and motifs.js.
import { findMistakes, coachCard } from './coachcard.js';
import { recordTags } from './trainer.js';
import { chromeAIStatus, chromeAICoach } from './ai.js';
import { speak } from './voice.js';
import { g, $ } from './state.js';

const NANO_MS = 10000;
let recordedGame = -1; // one profile update per game, even if it ends twice (undo after the end)

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

async function nanoSays(box, card, accuracy) {
  if ((await chromeAIStatus()) !== 'available') return;
  const gid = g.gameId;
  try {
    const text = await Promise.race([
      chromeAICoach({ accuracy, good: card.good, worst: card.worst?.text ?? null, focus: card.focus ? `${card.focus.label}: ${card.focus.tip}` : null }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), NANO_MS)),
    ]);
    if (gid === g.gameId && text) box.append(el('p', 'said', `Coach: “${text}”`));
  } catch (err) { console.warn('[checkmate] Chrome AI coach failed:', err); }
}

/** Appends the coach card for `color` to the result summary. `jump(ply)` shows the position after that ply. */
export function renderCoach(moves, scores, color, accuracy, jump) {
  const mistakes = findMistakes(moves, scores, color);
  if (recordedGame !== g.gameId) {
    recordedGame = g.gameId;
    recordTags(mistakes.filter((m) => m.skill).map(({ skill, kind }) => ({ skill, kind })));
  }
  const card = coachCard(mistakes, accuracy);
  const box = el('section', 'coach');
  box.setAttribute('aria-label', 'Coach');
  box.append(el('h3', null, 'Coach'), el('p', null, `✓ ${card.good}`));
  if (card.worst) {
    const p = el('p', null, `✗ ${card.worst.text}`);
    const b = el('button', null, 'Show');
    b.type = 'button';
    b.onclick = () => jump(card.worst.ply + 1);
    p.append(b);
    box.append(p);
  }
  if (card.focus) box.append(el('p', null, `→ Work on ${card.focus.label}: ${card.focus.tip}`));
  $('resultSummary').append(box);
  if (g.settings.speak) speak(card.focus ? `Next game, work on ${card.focus.label}.` : card.good);
  nanoSays(box, card, accuracy);
}

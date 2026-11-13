// The weakness trainer's state: the skill profile in localStorage, fed by puzzle results here and by game analysis
// (replay.js calls recordTags). The settings dialog lists the skills, and "Weak spots" puzzles train the weakest.
import { SKILLS, loadProfile, saveProfile, recordGame, recordPuzzle, ranked, weakest } from './skills.js';
import { $, on } from './state.js';

let profile = loadProfile(localStorage);
const set = (p) => { profile = p; saveProfile(localStorage, p); };

/** The skill to train ({skill, label, themes, tip}), or null before any game or puzzle has measured one. */
export function focusSkill() {
  const k = weakest(profile);
  return k && { skill: k, ...SKILLS[k] };
}

/** Records one game's tagged mistakes ([{skill, kind}]) for the player. */
export const recordTags = (tags) => set(recordGame(profile, tags));

// a puzzle counts once: its first wrong move, or a clean unassisted solve
on('puzzle-failed', ({ puzzle }) => set(recordPuzzle(profile, puzzle.themes, false)));
on('puzzle-solved', ({ puzzle, assisted, failed }) => { if (!assisted && !failed) set(recordPuzzle(profile, puzzle.themes, true)); });

/** Fills the settings dialog's skill list: weakest first, with a bar per skill. */
export function renderSkills() {
  const list = $('skills');
  const rows = ranked(profile);
  list.replaceChildren(...rows.map((r) => {
    const li = document.createElement('li');
    const bar = document.createElement('meter');
    Object.assign(bar, { min: 0, max: 100, low: 40, high: 70, optimum: 100, value: r.score });
    bar.setAttribute('aria-label', `${r.label} ${r.score} of 100`);
    li.append(`${r.label} `, bar, ` ${r.score}`);
    return li;
  }));
  $('skillsEmpty').hidden = rows.length > 0;
  const f = focusSkill();
  $('skillsFocus').textContent = f ? `Working on: ${f.label}. ${f.tip}` : '';
}

// The unfinished game in localStorage, so closing the popup window doesn't lose it. Online games aren't kept:
// a reopened window has no connection to resume.
const GAME_KEY = 'checkmate.game';

/** Saves `game` ({pgn, mode, color, clockSetting, hintsUsed, clock}) or clears the slot when `game` is null. */
export function saveGame(storage, game) {
  try {
    if (!game) storage.removeItem(GAME_KEY);
    else storage.setItem(GAME_KEY, JSON.stringify(game));
  } catch { /* storage disabled: the game just won't survive a closed window */ }
}

/** The saved game if it was played with the same mode, colour (vs computer) and clock as `settings`, else null. */
export function loadGame(storage, settings) {
  try {
    const g = JSON.parse(storage.getItem(GAME_KEY));
    const same = g && g.mode === settings.mode && (g.mode !== 'ai' || (g.color === settings.color && (g.level ?? settings.level) === settings.level)) && g.clockSetting === settings.clock;
    return same && typeof g.pgn === 'string' ? g : null;
  } catch { return null; }
}

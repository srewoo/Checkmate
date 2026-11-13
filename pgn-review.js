// Review your own game: paste a PGN in settings, pick the side you played, and it loads on a local board with the
// result card's accuracy summary, coach card and skill-profile update, like a game played here.
import { parsePgn } from './pgn.js';
import { newGame } from './play.js';
import { analyse } from './replay.js';
import { showResult } from './dialogs.js';
import { update } from './hud.js';
import { g, $, heard, isOver, emit, saveSettings, sideName } from './state.js';

function review() {
  const r = parsePgn($('pgnIn').value);
  if (r.error) { $('pgnStatus').textContent = r.error; return; }
  const side = $('settingsForm').pgnSide.value === 'b' ? 'b' : 'w';
  $('pgnStatus').textContent = '';
  $('settings').close();
  g.settings.mode = 'local'; // a reviewed game sits on a 2-player board: no computer, no clock
  saveSettings();
  newGame(false);
  g.clock = null;
  g.chess.loadPgn(r.pgn);
  g.reviewSide = side;
  g.view.flipped = side === 'b';
  g.view.last = g.chess.history({ verbose: true }).at(-1);
  const over = isOver();
  update(); // a finished game is announced here, which also starts the analysis
  const h = r.headers;
  const result = h.Result && h.Result !== '*' ? ` · ${h.Result}` : '';
  showResult('Game review', `${h.White ?? 'White'} vs ${h.Black ?? 'Black'}${result} · you played ${sideName(side)}`, r.pgn, () => emit('rematch'));
  $('replayBtn').hidden = false;
  if (!over) analyse();
  heard(`Reviewing your game as ${sideName(side)}. Click any move to see it.`);
}

$('pgnReview').onclick = review;

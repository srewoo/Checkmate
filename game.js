// Entry point: builds the board, wires buttons, voice, online play and settings, then starts or resumes a game.
// Game state lives in state.js, rendering in hud.js, moves and commands in play.js; feature modules subscribe to events.
import { createBoard3D } from './board3d.js';
import { setupSettings } from './settings-ui.js';
import { setupVoice } from './voice-ui.js';
import { setupOnline } from './online.js';
import { setAmbient } from './ambient.js';
import { loadGame } from './persist.js';
import { update } from './hud.js';
import { commit, onSquare, hint, newGame, resign, offerDraw, onPeerMessage, runCmd } from './play.js';
import { renderLadderInfo } from './ladder-ui.js';
import { renderAchievements } from './achievements-ui.js';
import { renderSkills } from './trainer.js';
import './coach.js';
import './puzzle-mode.js';
import './replay.js';
import './pgn-review.js';
import './emotes.js';
import { g, $, heard, sideName, canHumanMove, saveSettings } from './state.js';

const { settings } = g;

g.online = setupOnline({
  onOpen(color) {
    settings.mode = 'online';
    $('settings').close();
    newGame(false); // both sides reset locally; broadcasting here would race the first move
    heard(`Connected. You play ${sideName(color)}.`);
  },
  onClose() { update(); heard('Opponent disconnected.'); },
  onMessage: onPeerMessage,
});

let audioUnlocked = false; // autoplay policy: sound may only start after a user gesture
function applyLook() {
  document.body.dataset.scene = settings.scene;
  if (settings.tilt && !g.board3d) {
    try { g.board3d = createBoard3D($('board3d'), onSquare, () => { $('hint').hidden = true; }); } catch (err) {
      console.warn('[checkmate] WebGL unavailable, using the 2D board:', err);
      settings.tilt = false;
    }
  }
  g.board3d?.setScene(settings.scene);
  g.board3d?.setTheme(settings.theme);
  document.body.dataset.theme = settings.theme;
  document.body.classList.toggle('three', Boolean(g.board3d && settings.tilt));
  $('board3d').hidden = !(g.board3d && settings.tilt);
  if (audioUnlocked) setAmbient(settings.scene, settings.ambient);
}
document.addEventListener('pointerdown', () => { audioUnlocked = true; applyLook(); }, { once: true });

$('board').addEventListener('click', (e) => onSquare(e.target.closest('[data-sq]')?.dataset.sq));
// ponytail: 64 tab stops on the 2D fallback board; a roving tabindex if anyone finds it tedious
$('board').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSquare(e.target.dataset.sq); } });
$('hintBtn').onclick = hint;
$('undo').onclick = runCmd.undo;
$('flip').onclick = runCmd.flip;
$('newGame').onclick = runCmd.new;
$('resign').onclick = resign;
$('draw').onclick = offerDraw;

function setPanelMin(min) {
  settings.panelMin = min;
  $('panel').classList.toggle('min', min);
  const label = min ? 'Show controls' : 'Minimise controls';
  $('panelToggle').title = label;
  $('panelToggle').setAttribute('aria-label', label);
  $('panelToggle').setAttribute('aria-expanded', String(!min));
}
$('panelToggle').onclick = () => { setPanelMin(!settings.panelMin); saveSettings(); };
setPanelMin(settings.panelMin);

setupVoice({ chess: g.chess, commit, canHumanMove, runCmd, heard });

setupSettings(settings, {
  onOpen() { renderLadderInfo(); renderAchievements(); renderSkills(); },
  onLive() { applyLook(); saveSettings(); },
  onStart() {
    if (settings.mode !== 'online') g.online.disconnect();
    saveSettings();
    applyLook();
    newGame();
  },
});

if (settings.mode === 'online') settings.mode = 'local'; // a reopened window has no live connection
if (settings.engine !== 'chrome') settings.engine = 'stockfish'; // pre-Stockfish saves said 'classic'
applyLook();
const resumed = loadGame(localStorage, settings);
newGame(true, resumed);
if (resumed) heard('Welcome back. Your last game is restored.');

// Settings dialog: fills the form from `settings`, applies look/sound options live, starts a new game on "Start".
import { chromeAIStatus, warmChromeAI } from './ai.js';

const $ = (id) => document.getElementById(id);
const RADIOS = ['mode', 'color', 'level', 'engine', 'clock', 'pz', 'scene', 'theme'];
const CHECKS = ['tilt', 'speak', 'ambient', 'sfx', 'react', 'evalBar'];
const LIVE = ['scene', 'theme', 'ambient', 'sfx']; // applied as soon as they change, no new game needed

async function refreshAIStatus() {
  const s = await chromeAIStatus();
  $('aiStatus').textContent = {
    available: 'Chrome AI (Gemini Nano) is ready. It picks from the engine\'s best moves and explains them.',
    downloadable: 'Chrome AI model not downloaded yet. Select "Chrome built-in AI" to start the download.',
    downloading: 'Chrome AI model is downloading…',
    unavailable: 'Chrome built-in AI is unavailable here (needs Chrome 138+ on a supported device). Stockfish will play.',
  }[s] ?? s;
}

export function setupSettings(settings, { onOpen, onLive, onStart }) {
  const form = $('settingsForm');
  const dialog = $('settings');
  const read = (k) => (CHECKS.includes(k) ? form[k].checked : form[k].value);
  const syncGroups = () => {
    $('aiOpts').hidden = form.mode.value !== 'ai';
    $('onlineOpts').hidden = form.mode.value !== 'online';
    $('puzzleOpts').hidden = form.mode.value !== 'puzzle';
    $('clockOpts').hidden = form.mode.value === 'online' || form.mode.value === 'puzzle';
    $('engineOpts').hidden = form.level.value === 'ladder'; // ladder opponents are always Stockfish
    $('ladderInfo').hidden = form.level.value !== 'ladder';
  };

  $('settingsBtn').onclick = () => {
    for (const k of RADIOS) form[k].value = settings[k];
    for (const k of CHECKS) form[k].checked = settings[k];
    syncGroups();
    refreshAIStatus();
    onOpen?.();
    dialog.returnValue = '';
    dialog.showModal();
  };

  form.addEventListener('change', async (e) => {
    syncGroups();
    if (LIVE.includes(e.target.name)) {
      settings[e.target.name] = read(e.target.name);
      onLive();
    }
    if (e.target.name === 'engine' && form.engine.value === 'chrome' && (await chromeAIStatus()) === 'downloadable') {
      try {
        // the change event still carries the click's user activation, which the download requires
        await warmChromeAI((p) => { $('aiStatus').textContent = `Downloading Chrome AI model… ${Math.round(p * 100)}%`; });
      } catch (err) { $('aiStatus').textContent = `Couldn't start Chrome AI: ${err.message}`; return; }
      refreshAIStatus();
    }
  });

  dialog.addEventListener('close', () => {
    if (dialog.returnValue !== 'start') return;
    for (const k of [...RADIOS, ...CHECKS]) settings[k] = read(k);
    onStart();
  });
}

// Online emotes: four reactions you can send your opponent, floating up over the board on both screens.
// Peers send only an index into EMOTES, so nothing the other side sends is ever rendered as text.
import { g, $, on } from './state.js';

export const EMOTES = ['👏', '😮', '🤔', '😅'];
const LABELS = ['Well played', 'Wow', 'Hmm', 'Oops'];
const COOLDOWN = 1500; // per direction: stops either side flooding the screen
let lastSent = 0;
let lastShown = 0;

function float(i) {
  const el = Object.assign(document.createElement('span'), { className: 'emote', textContent: EMOTES[i] });
  el.style.left = `${35 + Math.random() * 30}%`;
  $('emoteLayer').append(el);
  setTimeout(() => el.remove(), 2400); // not animationend: reduced-motion turns the animation off and it never fires
}

$('emotes').innerHTML = EMOTES.map((e, i) => `<button type="button" data-emote="${i}" aria-label="Send ${LABELS[i]}">${e}</button>`).join('');
$('emotes').addEventListener('click', (e) => {
  const i = Number(e.target.closest('[data-emote]')?.dataset.emote);
  if (!Number.isInteger(i) || !g.online?.open || Date.now() - lastSent < COOLDOWN) return;
  lastSent = Date.now();
  g.online.send({ t: 'emote', i });
  float(i);
});

on('peer', (msg) => {
  if (msg.t !== 'emote' || !Number.isInteger(msg.i) || !EMOTES[msg.i] || Date.now() - lastShown < COOLDOWN / 2) return;
  lastShown = Date.now();
  float(msg.i);
});

on('update', () => { $('emotes').hidden = !(g.settings.mode === 'online' && g.online?.open); });

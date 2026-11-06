// One-line toasts over the board (move reactions, achievements). Queued so a burst of them is readable.
const $ = (id) => document.getElementById(id);
const queue = [];
let showing = false;

/** `kind` styles it: 'great' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'missed-mate' | 'trophy' | 'info'. */
export function toast(text, kind = 'info', ms = 2200) {
  queue.push({ text, kind, ms });
  if (!showing) next();
}

function next() {
  const item = queue.shift();
  const el = $('toast');
  if (!item) { showing = false; return; }
  showing = true;
  el.textContent = item.text;
  el.dataset.kind = item.kind;
  el.classList.add('show');
  setTimeout(() => { el.classList.remove('show'); setTimeout(next, 250); }, item.ms);
}

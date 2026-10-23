// Promotion picker and end-of-game card (both native <dialog>s in game.html).
const $ = (id) => document.getElementById(id);
const GLYPHS = { w: '♕♖♗♘', b: '♛♜♝♞' }; // same order as the buttons: q r b n

/** Resolves to 'q' | 'r' | 'b' | 'n', or null if the player backs out (Esc / Cancel). */
export function askPromotion(color) {
  const d = $('promo');
  d.querySelectorAll('.glyph').forEach((g, i) => { g.textContent = GLYPHS[color][i]; });
  d.returnValue = '';
  d.showModal();
  return new Promise((resolve) => d.addEventListener('close', () => resolve(d.returnValue || null), { once: true }));
}

/** Shows the result card. `onRematch` runs if the player picks Rematch. */
export function showResult(title, reason, pgn, onRematch) {
  const d = $('result');
  $('resultTitle').textContent = title;
  $('resultReason').textContent = reason;
  $('copyPgn').textContent = 'Copy PGN';
  $('copyPgn').onclick = async () => {
    try { await navigator.clipboard.writeText(pgn); $('copyPgn').textContent = 'Copied'; } catch { $('copyPgn').textContent = 'Copy failed'; }
  };
  d.returnValue = '';
  d.onclose = () => { if (d.returnValue === 'rematch') onRematch(); };
  if (!d.open) d.showModal();
}

/** Two-step button: the first press arms it for 3 s, the second press confirms. Returns true on confirm. */
export function confirmed(btn, onChange) {
  if (btn.dataset.armed) { delete btn.dataset.armed; return true; }
  btn.dataset.armed = '1';
  setTimeout(() => { delete btn.dataset.armed; onChange(); }, 3000);
  onChange();
  return false;
}

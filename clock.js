// Chess clock with Fischer increment. Time runs only for the side to move, starting after White's first move.
export const CONTROLS = ['off', '3+2', '5+0', '10+0', '15+10'];

/** "5+3" -> {base: 5 min, inc: 3 s} in ms; anything else (e.g. "off") -> null. */
export function parseControl(s) {
  const m = /^(\d+)\+(\d+)$/.exec(s ?? '');
  return m ? { base: +m[1] * 60000, inc: +m[2] * 1000 } : null;
}

/** m:ss, or s.t under ten seconds. */
export function formatClock(ms) {
  const t = Math.max(0, ms);
  if (t < 10000) return (Math.floor(t / 100) / 10).toFixed(1);
  const s = Math.ceil(t / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** HUD readout: one <span data-c="w|b"> per side; `s` is a clock state or null (hidden). */
export function renderClockHud(el, s) {
  el.hidden = !s;
  if (!s) return;
  for (const span of el.children) {
    const c = span.dataset.c;
    span.textContent = `${c === 'w' ? 'White' : 'Black'} ${formatClock(s[c])}`;
    span.classList.toggle('on', s.running && s.turn === c);
    span.classList.toggle('low', s[c] < 20000);
  }
}

/**
 * `resume` ({w, b, turn, plies}) restores a saved game paused: time starts again with the next move. Undo past the
 * resume point keeps the saved times (ponytail: per-move times aren't saved; save `history` if that ever matters).
 */
export function createClock(control, now = () => performance.now(), resume = null) {
  let left = resume ? { w: resume.w, b: resume.b } : { w: control.base, b: control.base };
  let turn = resume?.turn ?? 'w';
  let since = null; // when the running side's time started; null = stopped
  let flagged = null;
  const history = Array.from({ length: resume?.plies ?? 0 }, () => ({ ...left }));
  const running = (c) => (c === turn && since !== null ? left[c] - (now() - since) : left[c]);
  const freeze = () => { left[turn] = running(turn); since = null; };

  return {
    state() {
      if (!flagged && since !== null && running(turn) <= 0) { flagged = turn; freeze(); left[turn] = 0; }
      return { w: Math.max(0, running('w')), b: Math.max(0, running('b')), turn, running: since !== null, flagged };
    },
    /** Call after `color` moved. */
    moved(color) {
      if (flagged) return;
      history.push({ ...left });
      left[color] = running(color) + control.inc;
      turn = color === 'w' ? 'b' : 'w';
      since = now();
    },
    /** Take back one move: both clocks return to what they showed before it. */
    undo() {
      if (!history.length) return;
      left = history.pop();
      flagged = null;
      turn = turn === 'w' ? 'b' : 'w';
      since = history.length ? now() : null;
    },
    stop() { if (since !== null) freeze(); },
  };
}

// Pointer and keyboard input for the 3D board. A click is a press that didn't drag the camera; pressing on one of
// your pieces selects it and, if you move, picks it up and drags it (the camera stays put); hover is raycast at most
// once per frame; arrow keys move a cursor, Enter/Space picks, Escape drops the selection or cancels a drag.
import * as THREE from './vendor/three.module.min.js';
import { FILES, TOP, at } from './squares3d.js';
import { calm } from './motion3d.js';

const NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const KEYS = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
const CLICK = 6; // px of travel before a press counts as a drag
const LIFT = 0.6; // how high a dragged piece floats
const board = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP);

/** Square under a point on the board plane, or null off the board. */
function squareOf(p) {
  const f = Math.round(p.x + 3.5);
  const r = Math.round(4.5 - p.z);
  return f >= 0 && f < 8 && r >= 1 && r <= 8 ? FILES[f] + r : null;
}

/** Screen-reader echo for the keyboard cursor. */
function liveRegion(container) {
  const p = Object.assign(document.createElement('p'), { className: 'sr-only' });
  p.setAttribute('aria-live', 'polite');
  container.append(p);
  return p;
}

function describe(ui, sq) {
  const p = ui.chess?.get(sq);
  const move = ui.targets.has(sq) ? (ui.targets.get(sq) ? ', capture' : ', legal move') : '';
  return `${sq}, ${p ? `${p.color === 'w' ? 'white' : 'black'} ${NAMES[p.type]}` : 'empty'}${move}`;
}

export function createInput({ container, canvas, camera, controls, motion, pick, pieceAt, state, onSquare: choose, onHover, onHome }) {
  // game.js's handler is async (it may wait for the promotion dialog); selection and plain moves still apply synchronously
  const onSquare = (sq) => Promise.resolve(choose(sq)).catch((err) => console.warn('[checkmate] square handler failed:', err));
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const live = liveRegion(container);
  let hoverSq = null;
  let lastMove = null;
  let moved = false;
  let keyboard = false;
  let down = null;
  let press = null; // {sq, piece, x, y, id, wasSelected, active}: a press on your own piece
  const onPlane = new THREE.Vector3();
  const follow = new THREE.Vector3();

  function aim(e) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  }
  const planeAt = (e) => { aim(e); return ray.ray.intersectPlane(board, onPlane); };
  function squareAt(e) {
    aim(e);
    let o = ray.intersectObjects(pick(), true)[0]?.object;
    while (o && !o.userData.sq) o = o.parent;
    return o?.userData.sq ?? null;
  }
  const actionable = (sq) => {
    const { ui } = state();
    return Boolean(sq) && (ui.targets.has(sq) || ui.chess?.get(sq)?.color === ui.turn);
  };
  function setHover(sq, announce = false) {
    hoverSq = sq;
    onHover(sq, keyboard);
    canvas.classList.toggle('hot', actionable(sq));
    if (announce && sq) live.textContent = describe(state().ui, sq);
  }

  // Capture phase on the container runs before OrbitControls' own pointerdown on the canvas, so a press on a piece
  // can switch the camera off for that gesture; presses on empty squares or the room still orbit.
  container.addEventListener('pointerdown', (e) => {
    down = [e.clientX, e.clientY];
    if (press || e.button !== 0) { if (press) cancel(); return; }
    const sq = squareAt(e);
    const { ui } = state();
    if (!sq || ui.targets.has(sq) || ui.chess?.get(sq)?.color !== ui.turn) return;
    const wasSelected = ui.selected === sq;
    if (!wasSelected) onSquare(sq); // game.js selects it and re-renders synchronously
    if (state().ui.selected !== sq) return; // not ours to move right now: let the camera orbit
    controls.enabled = false;
    canvas.setPointerCapture(e.pointerId);
    press = { sq, piece: pieceAt(sq), x: e.clientX, y: e.clientY, id: e.pointerId, wasSelected, active: false };
  }, { capture: true });
  canvas.addEventListener('pointerup', (e) => {
    const click = down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) <= CLICK;
    if (press) { release(e); return; }
    const sq = click && squareAt(e);
    if (sq) onSquare(sq);
  });
  canvas.addEventListener('pointercancel', () => cancel());
  canvas.addEventListener('contextmenu', (e) => { if (press) { e.preventDefault(); cancel(); } });
  canvas.addEventListener('pointermove', (e) => {
    lastMove = e; moved = true; keyboard = false;
    if (!press || e.pointerId !== press.id) return;
    if (e.buttons & 2) { cancel(); return; } // right button joined in
    if (!press.active && Math.hypot(e.clientX - press.x, e.clientY - press.y) > CLICK) {
      press.active = true;
      motion.stop(press.piece);
    }
  });
  canvas.addEventListener('pointerleave', () => { if (!press) lastMove = null; moved = true; });
  canvas.addEventListener('dblclick', onHome);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && press) { e.stopPropagation(); cancel(); } }, true);

  const glideBack = (p) => motion.move(p.piece, at(p.sq), { dur: 0.25, squash: 0.4 });
  function end() {
    const p = press;
    press = null;
    controls.enabled = true;
    return p;
  }
  function cancel() {
    const p = end();
    if (p?.active) glideBack(p);
  }
  function release(e) {
    const p = end();
    if (!p.active) { if (p.wasSelected) onSquare(p.sq); return; } // a click: pressing selected it; clicking the selected piece again drops it
    const to = planeAt(e) && squareOf(onPlane);
    if (to && to !== p.sq && state().ui.targets.has(to)) {
      p.piece.userData.dropped = true; // syncPieces settles it from here instead of arcing again
      onSquare(to);
      if (pieceAt(p.sq) !== p.piece) return;
      p.piece.userData.dropped = false;
    }
    glideBack(p); // start square, illegal square or off the board: back home, still selected
  }

  /** While dragging: the piece floats above the board point under the pointer; the square below is highlighted. */
  function drag() {
    if (!lastMove || !planeAt(lastMove)) return;
    const sq = squareOf(onPlane);
    follow.copy(onPlane).clampScalar(-9, 9).setY(TOP + LIFT);
    press.piece.position.lerp(follow, calm() ? 1 : 0.35);
    hoverSq = sq;
    onHover(sq, Boolean(sq) && state().ui.targets.has(sq));
    canvas.classList.toggle('hot', true);
  }

  if (!container.hasAttribute('tabindex')) container.tabIndex = 0;
  container.addEventListener('blur', () => setHover(null));
  // focusing the board announces a starting square, so the first arrow press already moves the cursor
  container.addEventListener('focus', () => { if (!hoverSq) { keyboard = true; setHover(state().ui.selected ?? (state().flipped ? 'e7' : 'e2'), true); } });
  container.addEventListener('keydown', (e) => {
    const step = KEYS[e.key];
    if (!step && e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Escape') return;
    e.preventDefault();
    keyboard = true;
    const { ui, flipped } = state();
    if (e.key === 'Escape') { if (ui.selected && !press) onSquare(ui.selected); return; }
    if (!hoverSq) { setHover(ui.selected ?? (flipped ? 'e7' : 'e2'), true); if (!step) return; }
    if (!step) { onSquare(hoverSq); return; }
    const s = flipped ? -1 : 1;
    const f = THREE.MathUtils.clamp(FILES.indexOf(hoverSq[0]) + step[0] * s, 0, 7);
    const r = THREE.MathUtils.clamp(Number(hoverSq[1]) + step[1] * s, 1, 8);
    setHover(FILES[f] + r, true);
  });

  return {
    actionable,
    hovered: () => hoverSq,
    /** Once per frame: resolve the latest pointer position into a hovered square. */
    tick() {
      if (press?.active) { drag(); return; }
      if (!moved) return;
      moved = false;
      setHover(lastMove ? squareAt(lastMove) : null);
    },
    /** After the position changes: re-check the cursor style and re-announce the cursor square. */
    refresh() { setHover(hoverSq, keyboard); },
  };
}

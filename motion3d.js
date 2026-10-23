// Piece motion for the 3D board: travel arcs with a lean and a landing squash, capture tumbles,
// pose changes (the mated king toppling), contact shadows and a small camera shake.
import * as THREE from './vendor/three.module.min.js';

const calmQuery = matchMedia('(prefers-reduced-motion: reduce)');
export const calm = () => calmQuery.matches;
export const ease = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const SETTLE = 0.24; // seconds of squash after landing
const bounce = (t) => { // easeOutBounce, for the toppling king
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};

export function createMotion() {
  let tweens = [];
  let poses = [];
  let shake = null;

  /** Move group `g` to `to`. `lift` = arc height, `delay`/`dur` in seconds, `tumble` = flips while flying. */
  function move(g, to, { dur = 0.38, lift = 0, delay = 0, tumble = 0, squash, scale, onDone } = {}) {
    tweens = tweens.filter((t) => t.g !== g || delay > 0); // a delayed move queues behind the current one
    const quick = calm();
    tweens.push({
      g, to, from: null, dir: new THREE.Vector3(), squash: squash ?? Math.min(1, lift * 2), lift: quick ? 0 : lift, tumble: quick ? 0 : tumble, s0: g.scale.x, scale, onDone,
      t0: performance.now() + (quick ? 0 : delay * 1000), dur: (quick ? 0.12 : dur) * 1000, settle: quick || scale !== undefined ? 0 : SETTLE * 1000,
    });
  }

  function stepMove(t, now) {
    const el = now - t.t0;
    if (el < 0) return true;
    if (!t.from) {
      t.from = t.g.position.clone();
      t.dir.subVectors(t.to, t.from).setY(0);
      if (t.dir.lengthSq() > 1e-6) t.dir.normalize();
    }
    const k = Math.min(1, el / t.dur);
    const e = ease(k);
    const { g } = t;
    const fx = g.userData.fx;
    g.position.lerpVectors(t.from, t.to, e);
    g.position.y += Math.sin(Math.PI * e) * t.lift;
    if (t.scale !== undefined) g.scale.setScalar(t.s0 + (t.scale - t.s0) * e);
    if (fx && !fx.userData.posed) {
      const lean = Math.sin(Math.PI * k) * Math.min(0.22, t.lift * 0.25);
      const flip = t.tumble * Math.PI * 2 * e;
      fx.rotation.set(t.dir.z * (lean + flip), 0, -t.dir.x * (lean + flip));
      const s = k < 1 || !t.settle ? 0 : Math.min(1, (el - t.dur) / t.settle);
      const b = Math.sin(Math.PI * s) * (1 - s) * t.squash;
      fx.scale.set(1 + 0.07 * b, 1 - 0.12 * b, 1 + 0.07 * b);
    }
    if (k < 1 || el < t.dur + t.settle) return true;
    if (fx && !fx.userData.posed) fx.rotation.set(0, 0, 0); // drop whole tumble turns
    t.onDone?.();
    return false;
  }

  /** Ease the fx child of `g` into a pose: {rx, rz, y}. */
  function pose(g, { rx = 0, rz = 0, y = 0 }, { dur = 0.9, delay = 0 } = {}) {
    const fx = g.userData.fx;
    poses = poses.filter((p) => p.fx !== fx);
    poses.push({ fx, y, from: null, to: new THREE.Euler(rx, 0, rz), t0: performance.now() + (calm() ? 0 : delay * 1000), dur: (calm() ? 0.01 : dur) * 1000 });
  }

  function stepPose(p, now) {
    if (now < p.t0) return true;
    if (!p.from) {
      p.from = p.fx.rotation.clone();
      p.fx.userData.posed = Boolean(p.to.x || p.to.z);
      p.fx.userData.rest = p.y;
    }
    const k = Math.min(1, (now - p.t0) / p.dur);
    const e = p.to.x || p.to.z ? bounce(k) : ease(k);
    p.fx.rotation.set(p.from.x + (p.to.x - p.from.x) * e, 0, p.from.z + (p.to.z - p.from.z) * e);
    return k < 1;
  }

  /** Hover/selection lift (smoothed) and the contact blob that stays on the surface below. */
  function stepPiece(g, lift, floorY) {
    const fx = g.userData.fx;
    const target = (fx.userData.rest ?? 0) + lift;
    fx.position.y += (target - fx.position.y) * (calm() ? 1 : 0.2);
    const sh = g.userData.shadow;
    const h = Math.max(0, g.position.y - floorY) / g.scale.y + fx.position.y;
    sh.position.y = (floorY - g.position.y) / g.scale.y + 0.004;
    sh.scale.setScalar(Math.max(0.3, 1.05 - h * 0.35));
    sh.visible = h < 2.5;
  }

  function nudge(strength = 0.05) {
    if (!calm()) shake = { t0: performance.now(), strength };
  }

  /** Camera offset for this frame (add before render, subtract after). */
  function shakeOffset(now, out) {
    out.set(0, 0, 0);
    if (!shake) return out;
    const k = (now - shake.t0) / 280;
    if (k >= 1) { shake = null; return out; }
    const a = shake.strength * (1 - k);
    return out.set(Math.sin(now * 0.09) * a, Math.sin(now * 0.13) * a * 0.6, 0);
  }

  return {
    move, pose, nudge, stepPiece, shakeOffset,
    stop: (g) => { tweens = tweens.filter((t) => t.g !== g); },
    tick(now) {
      tweens = tweens.filter((t) => stepMove(t, now));
      poses = poses.filter((p) => stepPose(p, now));
    },
  };
}

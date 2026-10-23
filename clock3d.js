// Digital chess clock on the table: sloped LCD face with 7-segment digits drawn on a canvas, two buttons
// (the side to move has its button up and lit), turned towards whichever seat the camera is at.
import * as THREE from './vendor/three.module.min.js';
import { formatClock } from './clock.js';

const SEGMENTS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
const AMBER = '#ffb547';
const RED = '#ff4a3d';
const W = 1024;
const H = 320;
const LOW = 20000;

/** One hexagonal segment from (x, y), `len` long, horizontal or vertical. */
function segment(g, x, y, len, t, horizontal) {
  const h = t / 2;
  const gap = t * 0.18;
  g.beginPath();
  if (horizontal) {
    g.moveTo(x + gap, y); g.lineTo(x + gap + h, y - h); g.lineTo(x + len - gap - h, y - h);
    g.lineTo(x + len - gap, y); g.lineTo(x + len - gap - h, y + h); g.lineTo(x + gap + h, y + h);
  } else {
    g.moveTo(x, y + gap); g.lineTo(x + h, y + gap + h); g.lineTo(x + h, y + len - gap - h);
    g.lineTo(x, y + len - gap); g.lineTo(x - h, y + len - gap - h); g.lineTo(x - h, y + gap + h);
  }
  g.fill();
}

function digit(g, ch, x, y, w, h, on, ghost) {
  const t = w * 0.2;
  const parts = { a: [x, y, w, 1], g: [x, y + h / 2, w, 1], d: [x, y + h, w, 1], f: [x, y, h / 2, 0], b: [x + w, y, h / 2, 0], e: [x, y + h / 2, h / 2, 0], c: [x + w, y + h / 2, h / 2, 0] };
  for (const [k, [sx, sy, len, hz]] of Object.entries(parts)) {
    g.fillStyle = SEGMENTS[ch].includes(k) ? on : ghost;
    segment(g, sx, sy, len, t, hz);
  }
}

/** "12:34" / "9.4" in segments, right-aligned to `right`. */
function segmentText(g, text, right, y, color) {
  const dw = 54;
  const dh = 124;
  const adv = (c) => (c === ':' || c === '.' ? 30 : dw + 30);
  let x = right - [...text].reduce((a, c) => a + adv(c), 0);
  const ghost = 'rgba(255, 181, 71, 0.07)';
  for (const c of text) {
    g.fillStyle = color;
    if (c === ':') { g.fillRect(x + 6, y + dh * 0.28, 12, 12); g.fillRect(x + 6, y + dh * 0.68, 12, 12); }
    else if (c === '.') g.fillRect(x + 4, y + dh - 8, 14, 14);
    else digit(g, c, x + 12, y, dw, dh, color, ghost);
    x += adv(c);
  }
}

function drawFace(g, x, side, s) {
  const ms = s.flagged === side ? 0 : s[side];
  const lit = s.running && s.turn === side && !s.flagged;
  const color = ms < LOW || s.flagged === side ? RED : AMBER;
  g.fillStyle = '#060504';
  g.beginPath(); g.roundRect(x + 10, 10, W / 2 - 20, H - 20, 26); g.fill();
  const glow = g.createLinearGradient(0, 20, 0, H - 20);
  glow.addColorStop(0, lit ? '#2a1a08' : '#110c07');
  glow.addColorStop(1, lit ? '#1a1005' : '#0b0805');
  g.fillStyle = glow;
  g.beginPath(); g.roundRect(x + 24, 24, W / 2 - 48, H - 48, 16); g.fill();
  g.globalAlpha = lit ? 1 : 0.5;
  g.fillStyle = side === 'w' ? '#f4ead8' : '#1b1410';
  g.strokeStyle = '#a89880';
  g.lineWidth = 3;
  g.beginPath(); g.arc(x + 64, 66, 17, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#e9dcc6';
  g.font = '700 42px system-ui, sans-serif';
  g.textBaseline = 'middle';
  g.fillText(side === 'w' ? 'WHITE' : 'BLACK', x + 94, 68);
  g.save();
  g.transform(1, 0, -0.08, 1, 20, 0); // the slight italic of a real LCD
  segmentText(g, s.flagged === side ? '0:00' : formatClock(ms), x + W / 2 - 50, 120, color);
  g.restore();
  g.globalAlpha = 1;
  g.fillStyle = RED;
  if (lit) { g.beginPath(); g.moveTo(x + W / 2 - 70, 50); g.lineTo(x + W / 2 - 44, 66); g.lineTo(x + W / 2 - 70, 82); g.fill(); }
  if (s.flagged === side) { g.fillRect(x + W / 2 - 96, 44, 5, 46); g.beginPath(); g.moveTo(x + W / 2 - 91, 44); g.lineTo(x + W / 2 - 56, 56); g.lineTo(x + W / 2 - 91, 68); g.fill(); }
}

function clockBody() {
  // side profile, front (+x of the shape) faces the player: low front lip, sloped display, flat strip at the back for buttons
  const prof = new THREE.Shape([[-0.75, 0], [0.75, 0], [0.75, 0.4], [-0.35, 0.95], [-0.75, 0.95]].map(([u, v]) => new THREE.Vector2(u, v)));
  const geo = new THREE.ExtrudeGeometry(prof, { depth: 3.4, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
  geo.translate(0, 0, -1.7).rotateY(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0x151515, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function createClock() {
  const group = new THREE.Group();
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const g = canvas.getContext('2d');
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const slope = Math.atan2(0.55, 1.1);
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.03), new THREE.MeshBasicMaterial({ map, toneMapped: false }));
  lcd.rotation.x = -(Math.PI / 2 - slope);
  lcd.position.set(0, 0.675 + 0.05 * Math.cos(slope), 0.2 + 0.05 * Math.sin(slope));
  const buttons = [-0.85, 0.85].map((x) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.2, 24), new THREE.MeshStandardMaterial({ color: 0x8a8a8a, metalness: 0.6, roughness: 0.35, emissive: 0xffa53a, emissiveIntensity: 0 }));
    b.position.set(x, 0.99, -0.55);
    b.castShadow = true;
    return b;
  });
  group.add(clockBody(), lcd, ...buttons);
  group.visible = false;

  let shown = null;
  let order = ['w', 'b'];
  let state = null;
  let yaw = null;
  let yawTo = 0;
  const redraw = () => {
    const key = state && JSON.stringify([order, state.turn, state.running, state.flagged, ...order.map((c) => [formatClock(state[c]), state[c] < LOW])]);
    if (!state || key === shown) return;
    shown = key;
    g.clearRect(0, 0, W, H);
    order.forEach((side, i) => drawFace(g, i * (W / 2), side, state));
    map.needsUpdate = true;
  };

  return {
    group,
    /** null hides the clock; otherwise {w, b, turn, running, flagged} as game.js sends it. */
    set(s) {
      state = s;
      group.visible = Boolean(s);
      redraw();
    },
    /** Face the seat the camera is at; the viewer's own time is on the left. */
    face(flipped) {
      const [x, z] = [group.position.x, flipped ? -17 : 17];
      yawTo = Math.atan2(-x, z - group.position.z);
      if (yaw === null) yaw = yawTo;
      order = flipped ? ['b', 'w'] : ['w', 'b'];
      redraw();
    },
    tick(calm) {
      if (yaw !== null) {
        const d = Math.atan2(Math.sin(yawTo - yaw), Math.cos(yawTo - yaw));
        yaw += calm ? d : d * 0.08;
        group.rotation.y = yaw;
      }
      buttons.forEach((b, i) => {
        const up = state?.running && state.turn === order[i] && !state.flagged;
        b.position.y += ((up ? 1.03 : 0.95) - b.position.y) * (calm ? 1 : 0.25);
        b.material.emissiveIntensity = up ? 0.9 : 0;
      });
    },
  };
}

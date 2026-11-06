// Procedural Staunton-style pieces (lathe-turned profiles + an extruded knight head) and
// canvas wood-grain textures. Everything is generated in code: no model or texture files.
import * as THREE from './vendor/three.module.min.js';

const V = (x, y) => new THREE.Vector2(x, y);
// A crease: the point twice. LatheGeometry averages normals across a point; the zero-length segment between the
// copies has no normal, so each side keeps its own and the edge renders sharp instead of as a soft 45° bevel.
const C = (x, y) => [V(x, y), V(x, y)];
const arc = (cy, r, a0, a1, n = 10, sy = 1) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return V(Math.max(0, r * Math.cos(a)), cy + r * Math.sin(a) * sy);
  });

const BASE = [V(0, 0), ...C(0.38, 0), ...C(0.38, 0.05), ...C(0.34, 0.08), ...C(0.34, 0.12), ...C(0.28, 0.15)];
const PROFILES = {
  p: [...BASE, V(0.22, 0.18), V(0.13, 0.4), ...C(0.21, 0.44), ...C(0.21, 0.47), V(0.12, 0.5), ...arc(0.62, 0.15, -1.2, Math.PI / 2)],
  r: [...BASE, V(0.26, 0.2), V(0.22, 0.6), ...C(0.29, 0.66), ...C(0.29, 0.84), ...C(0.2, 0.84), ...C(0.2, 0.78), V(0, 0.78)],
  n: [...BASE, V(0.25, 0.2), V(0.23, 0.32), V(0, 0.32)],
  b: [...BASE, V(0.2, 0.2), V(0.12, 0.58), ...C(0.22, 0.62), ...C(0.22, 0.65), V(0.13, 0.68),
    ...arc(0.84, 0.17, -1.3, 1.25, 10, 1.25), ...arc(1.08, 0.05, -1.5, Math.PI / 2, 6)],
  q: [...BASE, V(0.23, 0.2), V(0.13, 0.74), ...C(0.25, 0.79), ...C(0.25, 0.82), V(0.15, 0.86), ...C(0.27, 1.04),
    V(0.2, 1.05), V(0.14, 1.02), ...arc(1.1, 0.07, -1.5, Math.PI / 2, 6)],
  k: [...BASE, V(0.24, 0.2), V(0.14, 0.8), ...C(0.26, 0.85), ...C(0.26, 0.88), V(0.16, 0.92), ...C(0.26, 1.1), V(0.16, 1.15), V(0, 1.16)],
};

// side silhouette, nose towards +x: chest, throat, jaw, muzzle, forehead, two ears, arched mane
const KNIGHT_HEAD = [
  [-0.24, 0.3], [0.18, 0.3], [0.2, 0.42], [0.15, 0.52], [0.24, 0.6], [0.37, 0.63], [0.45, 0.69],
  [0.45, 0.78], [0.36, 0.86], [0.23, 0.94], [0.15, 1.03], [0.11, 1.14], [0.05, 1.03], [-0.01, 1.1],
  [-0.07, 0.99], [-0.18, 0.93], [-0.26, 0.81], [-0.3, 0.66], [-0.3, 0.5], [-0.27, 0.38],
];

/** Extruded head, thinner towards the muzzle so it reads as a horse rather than a slab. */
function knightHead() {
  const shape = new THREE.Shape(KNIGHT_HEAD.map(([x, y]) => V(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.05, bevelSegments: 6, curveSegments: 6 });
  g.translate(0, 0, -0.1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * (1 - 0.45 * THREE.MathUtils.clamp((p.getX(i) + 0.05) / 0.5, 0, 1)));
  g.computeVertexNormals();
  return g;
}

const geoCache = new Map();
const geo = (key, make) => geoCache.get(key) ?? geoCache.set(key, make()).get(key);

function woodCanvas(light, dark, size, lines) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = light;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = dark;
  for (let i = 0; i < lines; i++) {
    g.globalAlpha = 0.06 + Math.random() * 0.16;
    g.lineWidth = 0.5 + Math.random() * 2.2;
    const y0 = Math.random() * size;
    const amp = 2 + Math.random() * 7;
    const f = 0.008 + Math.random() * 0.02;
    const ph = Math.random() * 6;
    g.beginPath();
    for (let x = 0; x <= size; x += 4) g.lineTo(x, y0 + Math.sin(x * f + ph) * amp);
    g.stroke();
  }
  return c;
}

/** Wood-grain texture. `canvas` lets callers draw extra marks (board coordinates) first. */
export function woodTexture(light, dark, { size = 256, lines = 40, repeat = 1, draw } = {}) {
  const c = woodCanvas(light, dark, size, lines);
  draw?.(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

// Lacquered boxwood and ebonised wood: glossy clearcoat over a satin base, lit by the PMREM environment.
let mats;
export function pieceMaterials() {
  mats ??= {
    w: new THREE.MeshPhysicalMaterial({
      color: 0xf4e2bf, map: woodTexture('#f3e2c2', '#b88a55', { lines: 24 }), roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.08,
    }),
    b: new THREE.MeshPhysicalMaterial({
      color: 0x5c4638, map: woodTexture('#5a463a', '#1a110c', { lines: 24 }), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06,
    }),
  };
  return mats;
}

// Shared "in check" materials; board3d pulses their emissive intensity.
let glows;
export function glowMaterials() {
  glows ??= Object.fromEntries(Object.entries(pieceMaterials()).map(([c, m]) => [c, Object.assign(m.clone(), { emissive: new THREE.Color(0xff2a14), emissiveIntensity: 0.5 })]));
  return glows;
}

/** Swap a piece between its normal and glowing material. */
export function setGlow(piece, on) {
  const m = on ? glowMaterials()[piece.userData.key[0]] : pieceMaterials()[piece.userData.key[0]];
  piece.userData.fx.traverse((o) => { if (o.isMesh) o.material = m; });
  return piece;
}

let blobMat;
const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
function contactShadow() {
  blobMat ??= new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.75 });
  const m = new THREE.Mesh(blobGeo, blobMat);
  m.renderOrder = 1;
  return m;
}

function blobTexture() {
  const c = Object.assign(document.createElement('canvas'), { width: 64, height: 64 });
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.85)');
  grd.addColorStop(0.45, 'rgba(0,0,0,0.45)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function extras(type, color) {
  const parts = [];
  if (type === 'r') {
    for (let i = 0; i < 4; i++) parts.push({ g: geo('merlon', () => new THREE.BoxGeometry(0.13, 0.1, 0.1)), at: [Math.cos(i * Math.PI / 2) * 0.24, 0.89, Math.sin(i * Math.PI / 2) * 0.24], ry: -i * Math.PI / 2 });
  }
  if (type === 'q') {
    for (let i = 0; i < 8; i++) parts.push({ g: geo('pearl', () => new THREE.SphereGeometry(0.065, 16, 10)), at: [Math.cos(i * Math.PI / 4) * 0.25, 1.07, Math.sin(i * Math.PI / 4) * 0.25] });
  }
  if (type === 'k') {
    parts.push({ g: geo('crossV', () => new THREE.BoxGeometry(0.09, 0.28, 0.09)), at: [0, 1.29, 0] });
    parts.push({ g: geo('crossH', () => new THREE.BoxGeometry(0.24, 0.09, 0.09)), at: [0, 1.32, 0] });
  }
  if (type === 'n') {
    parts.push({
      g: geo('knightHead', knightHead),
      at: [0, 0, 0],
      ry: Math.PI / 4 + (color === 'b' ? Math.PI : 0), // three-quarter view, facing the opponent
    });
  }
  return parts;
}

/**
 * A piece as a Group whose origin sits at the centre of its base. The group carries travel;
 * `userData.fx` (child) carries flourishes (lean, squash, hover lift, topple); `userData.shadow` is the contact blob.
 */
export function makePiece(type, color) {
  const mat = pieceMaterials()[color];
  const group = new THREE.Group();
  const fx = new THREE.Group();
  fx.add(new THREE.Mesh(geo(type, () => new THREE.LatheGeometry(PROFILES[type], 40)), mat));
  for (const { g, at, ry = 0 } of extras(type, color)) {
    const m = new THREE.Mesh(g, mat);
    m.position.set(...at);
    m.rotation.y = ry;
    fx.add(m);
  }
  fx.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
  const shadow = contactShadow();
  group.add(fx, shadow);
  group.scale.setScalar(0.95);
  group.userData = { key: color + type, fx, shadow };
  return group;
}

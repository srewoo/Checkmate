// Park: a mottled lawn worn bare under the table, a gravel path with a bench and flowers, a big shade tree with
// dappled shadow, a lamp post, rounded trees around the edge and a distant tree line on the horizon.
import * as THREE from './vendor/three.module.min.js';
import { tex, rnd, sky } from './textures3d.js';
import * as R from './textures-rooms.js';
import { FLOOR, std, mesh, floorPlane, chair, crown } from './room-kit.js';

const pathZ = (x) => -17 + Math.sin(x * 0.05) * 4;

/** Gravel ribbon following pathZ, `w` wide. */
function path(w = 4.6) {
  const pts = [];
  const uvs = [];
  const idx = [];
  for (let i = 0; i <= 80; i++) {
    const x = -80 + i * 2;
    for (const s of [-1, 1]) { pts.push(x, FLOOR + 0.03, pathZ(x) + (s * w) / 2); uvs.push(i * 0.5, s > 0 ? 1 : 0); }
    if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i); // counter-clockwise from above
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return mesh(geo, std({ map: tex(256, R.gravel), roughness: 1 }), [0, 0, 0], false);
}

/** Soft transparent decal lying on the grass (worn patch, tree shade). */
function decal(size, draw, [x, z], opacity = 1) {
  const m = new THREE.MeshBasicMaterial({ map: tex(256, draw), transparent: true, opacity, depthWrite: false });
  const d = mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), m, [x, FLOOR + 0.02, z], false);
  d.renderOrder = 1;
  return d;
}
const worn = (g, s) => {
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(96,78,52,0.75)'); grd.addColorStop(0.6, 'rgba(96,78,52,0.35)'); grd.addColorStop(1, 'rgba(96,78,52,0)');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
};
const dapple = (g, s) => {
  for (let i = 0; i < 160; i++) {
    const x = s / 2 + rnd(-0.42, 0.42) * s;
    const y = s / 2 + rnd(-0.42, 0.42) * s;
    const r = rnd(6, 22);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(10,20,5,0.3)'); grd.addColorStop(1, 'rgba(10,20,5,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
};

function shadeTree(x, z) {
  const t = new THREE.Group();
  const bark = std({ color: 0x4f3c2c, roughness: 1 });
  t.add(mesh(new THREE.CylinderGeometry(0.9, 1.4, 12, 10), bark, [0, FLOOR + 6, 0]));
  for (const [a, tilt] of [[0.3, 0.7], [2.4, 0.8], [4.3, 0.6]]) {
    const b = mesh(new THREE.CylinderGeometry(0.35, 0.6, 7, 7), bark, [Math.cos(a) * 1.8, FLOOR + 13.5, Math.sin(a) * 1.8]);
    b.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
    t.add(b);
  }
  t.add(crown(1100, 7.5, FLOOR + 18, 0x4b6b35, 1.1));
  t.add(decal(26, dapple, [0, 0]));
  t.position.set(x, 0, z);
  return t;
}

/** Background tree: smooth noisy crown with per-vertex tone, cheaper than leaves at distance. */
function roundTree(x, z) {
  const t = new THREE.Group();
  t.add(mesh(new THREE.CylinderGeometry(0.5, 0.8, 9, 7), std({ color: 0x4f3c2c }), [0, FLOOR + 4.5, 0]));
  const geo = new THREE.IcosahedronGeometry(rnd(3.4, 4.6), 2);
  const p = geo.attributes.position;
  const colors = [];
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    v.multiplyScalar(1 + Math.sin(v.x * 1.7) * Math.cos(v.z * 1.3) * 0.12 + rnd(-0.04, 0.04));
    p.setXYZ(i, v.x, v.y, v.z);
    const k = 0.75 + (v.y / 5) * 0.2 + rnd(-0.05, 0.05);
    colors.push(0.33 * k, 0.45 * k, 0.24 * k);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  t.add(mesh(geo, std({ vertexColors: true }), [0, FLOOR + 11, 0]));
  t.position.set(x, 0, z);
  return t;
}

function bench(x, z, ry) {
  const b = new THREE.Group();
  const teak = std({ color: 0x8a6a4a, roughness: 0.8 });
  const iron = std({ color: 0x1e2322, metalness: 0.6, roughness: 0.5 });
  for (let i = 0; i < 4; i++) b.add(mesh(new THREE.BoxGeometry(8, 0.2, 0.55), teak, [0, FLOOR + 2.6, -0.9 + i * 0.62]));
  for (let i = 0; i < 3; i++) b.add(mesh(new THREE.BoxGeometry(8, 0.55, 0.18), teak, [0, FLOOR + 3.6 + i * 0.7, -1.25]));
  for (const dx of [-3.4, 3.4]) b.add(mesh(new THREE.BoxGeometry(0.25, 2.6, 2.6), iron, [dx, FLOOR + 1.3, -0.2]), mesh(new THREE.BoxGeometry(0.25, 3, 0.25), iron, [dx, FLOOR + 4, -1.35]));
  b.position.set(x, 0, z);
  b.rotation.y = ry;
  return b;
}

function lampPost(x, z) {
  const l = new THREE.Group();
  const iron = std({ color: 0x1b1f1e, metalness: 0.5, roughness: 0.5 });
  l.add(mesh(new THREE.CylinderGeometry(0.2, 0.35, 13, 8), iron, [0, FLOOR + 6.5, 0]));
  l.add(mesh(new THREE.CylinderGeometry(0.5, 0.9, 1.6, 6), new THREE.MeshBasicMaterial({ color: 0xfff0cc }), [0, FLOOR + 13.6, 0]));
  l.add(mesh(new THREE.ConeGeometry(1.2, 0.9, 6), iron, [0, FLOOR + 14.8, 0]));
  l.position.set(x, 0, z);
  return l;
}

function flowers(n) {
  const f = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.22, 0), std({ roughness: 0.8 }), n);
  const d = new THREE.Object3D();
  const palette = [0xf4f1e6, 0xe8c547, 0x9a7fc7, 0xd96a6a].map((c) => new THREE.Color(c));
  for (let i = 0; i < n; i++) {
    const x = rnd(-40, 40);
    const side = Math.random() < 0.5 ? -1 : 1;
    d.position.set(x, FLOOR + rnd(0.3, 0.8), pathZ(x) + side * rnd(2.8, 5));
    d.updateMatrix();
    f.setMatrixAt(i, d.matrix);
    f.setColorAt(i, palette[Math.floor(i / 6) % palette.length]);
  }
  return f;
}

/** Distant tree line: a ring textured with soft canopy silhouettes, faded by the fog. */
function horizon() {
  const map = tex(1024, (g, s) => {
    for (let i = 0; i < 220; i++) {
      const x = rnd(0, s);
      const r = rnd(20, 60);
      const y = s * 0.75 - rnd(0, s * 0.35);
      g.fillStyle = `hsl(${rnd(85, 110)},${rnd(18, 28)}%,${rnd(22, 34)}%)`;
      for (const ox of [-s, 0, s]) { g.beginPath(); g.arc(x + ox, y, r, 0, Math.PI * 2); g.fill(); g.fillRect(x + ox - r, y, r * 2, s); }
    }
  }, 4, 1);
  const m = new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.BackSide, fog: true, alphaTest: 0.5 });
  return mesh(new THREE.CylinderGeometry(85, 85, 30, 48, 1, true), m, [0, FLOOR + 12, 0], false);
}

export function park(g) {
  g.add(floorPlane(tex(1024, R.lawn, 12), { roughness: 1, under: 0.55 }), decal(24, worn, [0, 0], 0.9), path(), flowers(90));
  g.add(shadeTree(-20, -26), bench(13, -22.5, -0.15), lampPost(-8, -21), horizon());
  for (let i = 0; i < 16; i++) {
    const a = rnd(0, Math.PI * 2);
    const d = rnd(38, 60); // beyond orbit range, so the camera never ends up inside a tree
    g.add(roundTree(Math.cos(a) * d, Math.sin(a) * d));
  }
  const teak = { wood: ['#8a6a4a', '#4a3524'], fabric: 0x6f7d5a };
  g.add(chair(-11.5, 0, teak), chair(11.5, Math.PI, teak));
  return {
    background: sky('#7aa6cc', '#e2e7de'), fog: ['#aab8b2', 42, 120], hemi: [0xeef4ff, 0x3d4a2c, 0.85], sun: [0xfff1d2, 2.6], key: [0xfff0d8, 0.7],
  };
}

// The table and the room around it, one room per background. All geometry is built here.
import * as THREE from './vendor/three.module.min.js';
import { woodTexture } from './pieces3d.js';
import * as T from './textures3d.js';

export const TABLE_Y = -0.15; // table surface
const FLOOR = -9.6;
const WALL = 28; // distance from the table to each wall
const { rnd } = T;

const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
function mesh(geo, material, [x, y, z] = [0, 0, 0], shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

function roundedRect(w, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Rounded lacquered table with legs, a chess clock and a flower vase. */
export function buildTable() {
  const g = new THREE.Group();
  const SIZE = 19;
  const map = woodTexture('#6a3d22', '#241005', { size: 1024, lines: 150 });
  map.repeat.set(1 / SIZE, 1 / SIZE);
  map.offset.set(0.5, 0.5);
  const wood = new THREE.MeshPhysicalMaterial({ map, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  const topGeo = new THREE.ExtrudeGeometry(roundedRect(SIZE, SIZE, 1.8), {
    depth: 0.45, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 4, curveSegments: 14,
  }).rotateX(-Math.PI / 2);
  topGeo.computeBoundingBox();
  topGeo.translate(0, TABLE_Y - topGeo.boundingBox.max.y, 0);
  g.add(mesh(topGeo, wood));

  const legWood = std({ map: woodTexture('#7a4423', '#2e1406', { lines: 40 }), roughness: 0.45 });
  const legLen = TABLE_Y - 0.7 - FLOOR;
  for (const [x, z] of [[-7.8, -7.8], [7.8, -7.8], [-7.8, 7.8], [7.8, 7.8]]) {
    g.add(mesh(new THREE.CylinderGeometry(0.42, 0.3, legLen, 16), legWood, [x, FLOOR + legLen / 2, z]));
  }
  for (const [w, d, x, z] of [[15, 0.4, 0, -7.8], [15, 0.4, 0, 7.8], [0.4, 15, -7.8, 0], [0.4, 15, 7.8, 0]]) {
    g.add(mesh(new THREE.BoxGeometry(w, 1, d), legWood, [x, TABLE_Y - 1.1, z]));
  }

  // chess clock, faces angled towards the player
  const clock = new THREE.Group();
  const black = new THREE.MeshPhysicalMaterial({ color: 0x1a1a1a, roughness: 0.35, clearcoat: 0.8 });
  clock.add(mesh(new THREE.BoxGeometry(1.5, 1.8, 3.4), black, [0, 0.9, 0]));
  const face = new THREE.MeshStandardMaterial({ map: T.tex(256, T.dial), roughness: 0.3 });
  for (const z of [-0.8, 0.8]) {
    const d = mesh(new THREE.CircleGeometry(0.58, 32), face, [-0.76, 1.0, z], false);
    d.rotation.y = -Math.PI / 2;
    clock.add(d);
    clock.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 16), std({ color: 0xd8d8d8, metalness: 0.8, roughness: 0.3 }), [0, 1.95, z]));
  }
  clock.position.set(6.6, TABLE_Y, -1.6);
  clock.rotation.y = 0.55;
  g.add(clock);

  // vase of cotton-like blossoms
  const vase = new THREE.Group();
  vase.add(mesh(new THREE.LatheGeometry([[0, 0], [0.55, 0], [0.75, 0.6], [0.7, 1.3], [0.42, 1.7], [0.45, 1.9]].map(([x, y]) => new THREE.Vector2(x, y)), 32),
    new THREE.MeshPhysicalMaterial({ color: 0x3a3a3c, roughness: 0.5, clearcoat: 0.4 })));
  const stem = std({ color: 0x4a3524 });
  const bloom = std({ color: 0xf4f1ea, roughness: 0.95 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rnd(-0.3, 0.3);
    const h = rnd(1.6, 2.8);
    const tilt = rnd(0.15, 0.45);
    const tip = new THREE.Vector3(Math.cos(a) * h * tilt, 1.8 + h, Math.sin(a) * h * tilt);
    const s = mesh(new THREE.CylinderGeometry(0.03, 0.04, h, 5), stem, [tip.x / 2, 1.8 + h / 2, tip.z / 2]);
    s.lookAt(tip); s.rotateX(Math.PI / 2);
    vase.add(s);
    vase.add(mesh(new THREE.IcosahedronGeometry(rnd(0.22, 0.3), 1), bloom, [tip.x, tip.y, tip.z]));
  }
  vase.position.set(-6.5, TABLE_Y, -3.4);
  g.add(vase);
  return g;
}

function chair(z, ry) {
  const c = new THREE.Group();
  const wood = std({ map: woodTexture('#c9894e', '#7a4a22', { lines: 30 }), roughness: 0.5 });
  const cloth = std({ color: 0xc9c6bf, roughness: 1 });
  const seatY = FLOOR + 5.4;
  c.add(mesh(new THREE.BoxGeometry(6.2, 0.45, 5.6), wood, [0, seatY, 0]));
  c.add(mesh(new THREE.BoxGeometry(5.6, 0.4, 5), cloth, [0, seatY + 0.4, 0.1]));
  for (const [x, zz] of [[-2.8, -2.5], [2.8, -2.5], [-2.8, 2.5], [2.8, 2.5]]) {
    c.add(mesh(new THREE.BoxGeometry(0.45, 5.4, 0.45), wood, [x, FLOOR + 2.7, zz]));
  }
  for (const x of [-2.9, 2.9]) c.add(mesh(new THREE.BoxGeometry(0.45, 5.6, 0.45), wood, [x, seatY + 2.8, -2.6]));
  c.add(mesh(new THREE.BoxGeometry(5.6, 3.4, 0.4), cloth, [0, seatY + 3.8, -2.6]));
  c.position.z = z;
  c.rotation.y = ry;
  return c;
}

function foliage(group, n, spread, y, colors = [0x3f7a2c, 0x4f8f35, 0x346a26]) {
  for (let i = 0; i < n; i++) {
    const m = mesh(new THREE.IcosahedronGeometry(rnd(0.7, 1.3), 0), std({ color: colors[i % colors.length], flatShading: true }),
      [rnd(-spread, spread), y + rnd(0, 1.6), rnd(-spread / 3, spread / 3)]);
    m.rotation.set(rnd(0, 3), rnd(0, 3), 0);
    group.add(m);
  }
}

function planter(x, z, ry = 0) {
  const p = new THREE.Group();
  p.add(mesh(new THREE.BoxGeometry(7, 2.6, 2.4), std({ color: 0x232323, roughness: 0.6 }), [0, FLOOR + 1.3, 0]));
  foliage(p, 14, 3, FLOOR + 3);
  p.position.set(x, 0, z);
  p.rotation.y = ry;
  return p;
}

function tree(x, z) {
  const t = new THREE.Group();
  t.add(mesh(new THREE.CylinderGeometry(0.5, 0.8, 9, 8), std({ color: 0x5a3d26 }), [0, FLOOR + 4.5, 0]));
  for (let i = 0; i < 4; i++) {
    t.add(mesh(new THREE.IcosahedronGeometry(rnd(2.6, 3.6), 1), std({ color: [0x3b7a2e, 0x2f6a27, 0x4a8a36][i % 3], flatShading: true }),
      [rnd(-1.5, 1.5), FLOOR + rnd(10, 13), rnd(-1.5, 1.5)]));
  }
  t.position.set(x, 0, z);
  return t;
}

const floor = (map) => mesh(new THREE.PlaneGeometry(160, 160).rotateX(-Math.PI / 2), std({ map }), [0, FLOOR, 0], false);

/** The same wall (plus anything in `extra`) on the back, left and right sides. */
function walls(map, extra) {
  const g = new THREE.Group();
  for (const ry of [0, Math.PI / 2, -Math.PI / 2]) {
    const side = new THREE.Group();
    side.add(mesh(new THREE.PlaneGeometry(WALL * 2, 26), std({ map }), [0, FLOOR + 13, -WALL], false));
    extra?.(side);
    side.rotation.y = ry;
    g.add(side);
  }
  return g;
}

function trellis(side) {
  const beam = std({ color: 0x2b1a10, roughness: 0.7 });
  for (let x = -WALL; x <= WALL; x += 4.5) side.add(mesh(new THREE.BoxGeometry(0.45, 26, 0.45), beam, [x, FLOOR + 13, -WALL + 0.5], false));
  for (const y of [6, 13, 20]) side.add(mesh(new THREE.BoxGeometry(WALL * 2, 0.45, 0.45), beam, [0, FLOOR + y, -WALL + 0.6], false));
}

const ROOMS = {
  indoor: (g) => {
    g.add(floor(T.tex(1024, T.cobbles, 14)), walls(T.tex(512, T.bricks, 7, 3.2), trellis));
    g.add(planter(-14, -WALL + 2), planter(14, -WALL + 2), planter(WALL - 2, -12, Math.PI / 2));
    return { background: T.sky('#7d9fb8', '#e2d6c0'), fog: ['#cfc4b0', 55, 120], hemi: [0xfff1dc, 0x3a2e24, 1.0], sun: [0xffe2b8, 2.6] };
  },
  park: (g) => {
    g.add(floor(T.tex(1024, T.grass, 16)));
    for (let i = 0; i < 22; i++) {
      const a = rnd(0, Math.PI * 2);
      const d = rnd(32, 56); // beyond orbit range, so the camera never ends up inside a tree
      g.add(tree(Math.cos(a) * d, Math.sin(a) * d));
    }
    return { background: T.sky('#5aa9e0', '#d9eefa'), fog: ['#d4ebf7', 45, 110], hemi: [0xe8f4ff, 0x3d5a2a, 1.15], sun: [0xfff4d6, 2.9] };
  },
  office: (g) => {
    g.add(floor(T.tex(512, T.carpet, 18)), walls(T.tex(256, T.paint('#d6cfc2'), 4)));
    const win = mesh(new THREE.PlaneGeometry(18, 10), new THREE.MeshBasicMaterial({ map: T.tex(256, T.blinds) }), [6, FLOOR + 14, -WALL + 0.05], false);
    const frame = std({ color: 0xf4f1ea });
    g.add(win, mesh(new THREE.BoxGeometry(19, 0.6, 0.6), frame, [6, FLOOR + 8.8, -WALL + 0.3]), mesh(new THREE.BoxGeometry(19, 0.6, 0.6), frame, [6, FLOOR + 19.2, -WALL + 0.3]));
    const shelf = new THREE.Group();
    shelf.add(mesh(new THREE.BoxGeometry(12, 14, 2), std({ color: 0x3a2618 }), [0, FLOOR + 7, 0]));
    shelf.add(mesh(new THREE.PlaneGeometry(11.4, 13.4), std({ map: T.tex(512, T.books) }), [0, FLOOR + 7, 1.01], false));
    shelf.position.set(-14, 0, -WALL + 1.2);
    const pot = new THREE.Group();
    pot.add(mesh(new THREE.CylinderGeometry(1.4, 1.1, 2.8, 20), std({ color: 0xe8e2d6 }), [0, FLOOR + 1.4, 0]));
    foliage(pot, 12, 1.6, FLOOR + 3.4);
    pot.position.set(WALL - 4, 0, -WALL + 4);
    g.add(shelf, pot);
    return { background: new THREE.Color('#d6cfc2'), fog: ['#d6cfc2', 60, 130], hemi: [0xffffff, 0x50545c, 1.1], sun: [0xffffff, 2.3] };
  },
  pool: (g) => {
    g.add(floor(T.tex(512, T.deck, 20)));
    const waterMap = T.tex(512, T.water, 3, 3);
    g.add(mesh(new THREE.PlaneGeometry(44, 34).rotateX(-Math.PI / 2), std({ map: waterMap, roughness: 0.15, metalness: 0.1 }), [0, FLOOR + 0.03, -36], false));
    const coping = std({ color: 0xf6f4ef });
    for (const [w, d, x, z] of [[46, 1, 0, -18.5], [46, 1, 0, -53.5], [1, 36, -22.5, -36], [1, 36, 22.5, -36]]) g.add(mesh(new THREE.BoxGeometry(w, 0.3, d), coping, [x, FLOOR + 0.15, z], false));
    const rope = std({ map: T.tex(64, T.stripes('#d6332a', '#f5f5f5', 2), 40, 1) });
    for (const x of [-13.2, -4.4, 4.4, 13.2]) g.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 34, 8).rotateX(Math.PI / 2), rope, [x, FLOOR + 0.15, -36], false));
    for (const x of [-17, 17]) {
      g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 10, 8), std({ color: 0xdddddd, metalness: 0.6 }), [x, FLOOR + 5, -4]));
      g.add(mesh(new THREE.ConeGeometry(5, 1.8, 8, 1, true), std({ map: T.tex(128, T.stripes('#f2f2f2', '#2a8fd0', 8)), side: THREE.DoubleSide }), [x, FLOOR + 10.4, -4]));
    }
    return {
      background: T.sky('#4aa3e0', '#cdeefc'), fog: ['#cdeefc', 55, 120], hemi: [0xeaf6ff, 0x6a8aa0, 1.2], sun: [0xfff6e0, 3],
      tick: (now) => { waterMap.offset.set(now * 0.00001, now * 0.000006); },
    };
  },
};

/** Room for a background name: {group, background, fog, hemi, sun, tick?}. */
export function buildRoom(name) {
  const group = new THREE.Group();
  group.add(chair(-11.5, 0), chair(11.5, Math.PI));
  const env = (ROOMS[name] ?? ROOMS.indoor)(group);
  return { group, ...env };
}

export function disposeTree(root) {
  root.traverse((o) => {
    o.geometry?.dispose();
    for (const m of [o.material].flat().filter(Boolean)) { m.map?.dispose(); m.dispose(); }
  });
}

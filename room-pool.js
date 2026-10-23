// Swimming pool: off-white deck tiles with a wet margin, rippling water (scrolling normal map + caustic light),
// lane ropes with floats, scalloped parasols on wooden poles framing the table, and a lounger with a towel.
import * as THREE from './vendor/three.module.min.js';
import { woodTexture } from './pieces3d.js';
import { tex, rnd, sky, stripes } from './textures3d.js';
import * as R from './textures-rooms.js';
import { FLOOR, std, mesh, slab, floorPlane, chair } from './room-kit.js';

const POOL = { x: 0, z: -38, w: 44, d: 34 };

/** Seamless ripple normal map: a few integer-frequency waves, differentiated per pixel. */
function rippleNormals(s = 256) {
  const c = Object.assign(document.createElement('canvas'), { width: s, height: s });
  const g = c.getContext('2d');
  const img = g.createImageData(s, s);
  const waves = Array.from({ length: 6 }, () => [Math.round(rnd(-5, 5)) || 1, Math.round(rnd(-5, 5)) || 2, rnd(0, 6), rnd(0.5, 1)]);
  const h = (x, y) => waves.reduce((a, [kx, ky, ph, amp]) => a + amp * Math.sin(((kx * x + ky * y) / s) * Math.PI * 2 + ph), 0);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * 4;
      const dy = (h(x, y + 1) - h(x, y - 1)) * 4;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * s + x) * 4;
      img.data.set([(-dx / l) * 127 + 128, (-dy / l) * 127 + 128, (1 / l) * 127 + 128, 255], i);
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 4);
  return t;
}

/** Water plane: lighter teal at the edges (vertex colours), ripples and caustics that drift in tick(). */
function water() {
  const geo = new THREE.PlaneGeometry(POOL.w, POOL.d, 24, 18).rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const col = [];
  for (let i = 0; i < p.count; i++) {
    const e = Math.max(Math.abs(p.getX(i)) / (POOL.w / 2), Math.abs(p.getZ(i)) / (POOL.d / 2));
    const k = 1 + THREE.MathUtils.smoothstep(e, 0.6, 1) * 0.35;
    col.push(0.85 * k, k, k);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const normalMap = rippleNormals();
  const emissiveMap = tex(512, R.caustics, 4, 3);
  const m = std({ map: tex(512, R.poolWater, 4, 1), vertexColors: true, roughness: 0.06, normalMap, normalScale: new THREE.Vector2(0.5, 0.5), emissive: 0xffffff, emissiveMap, emissiveIntensity: 0.22 });
  return { mesh: mesh(geo, m, [POOL.x, FLOOR + 0.03, POOL.z], false), normalMap, emissiveMap };
}

function poolEdge() {
  const g = new THREE.Group();
  const coping = std({ color: 0xf3f0e9, roughness: 0.6 });
  const wet = std({ color: 0xb9b2a5, roughness: 0.12, transparent: true, opacity: 0.45, depthWrite: false });
  const { x, z, w, d } = POOL;
  for (const [sw, sd, dx, dz] of [[w + 2, 1, 0, d / 2 + 0.5], [w + 2, 1, 0, -d / 2 - 0.5], [1, d, -w / 2 - 0.5, 0], [1, d, w / 2 + 0.5, 0]]) {
    g.add(mesh(slab(sw, sd, 0.35, 0.15), coping, [x + dx, FLOOR, z + dz], false));
  }
  g.add(mesh(new THREE.PlaneGeometry(w + 4, 3).rotateX(-Math.PI / 2), wet, [x, FLOOR + 0.02, z + d / 2 + 2.4], false)); // splashed margin
  // lane ropes: floats strung along each line, alternating red and white
  const lanes = [-13.2, -4.4, 4.4, 13.2];
  const per = 30;
  const floats = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.28, 0.75, 10).rotateX(Math.PI / 2), std({ roughness: 0.4 }), lanes.length * per);
  const dummy = new THREE.Object3D();
  const red = new THREE.Color(0xd6332a);
  const white = new THREE.Color(0xf5f5f5);
  lanes.forEach((lx, l) => {
    for (let i = 0; i < per; i++) {
      dummy.position.set(x + lx, FLOOR + 0.18, z - d / 2 + (i + 0.5) * (d / per));
      dummy.updateMatrix();
      floats.setMatrixAt(l * per + i, dummy.matrix);
      floats.setColorAt(l * per + i, i % 6 < 3 ? red : white);
    }
  });
  g.add(floats);
  return g;
}

/** Parasol: striped canopy with a scalloped hem between 8 ribs, on a wooden pole. */
function parasol(x, z) {
  const p = new THREE.Group();
  const ribs = 8;
  const geo = new THREE.ConeGeometry(5.5, 1.7, ribs * 6, 3, true);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getZ(i), pos.getX(i));
    const rim = (pos.getY(i) + 0.85) / 1.7; // 0 at the hem
    const between = Math.abs(Math.sin((a * ribs) / 2)); // 0 on a rib, 1 midway between ribs
    const sag = (1 - rim) * between;
    pos.setXYZ(i, pos.getX(i) * (1 - 0.05 * sag), pos.getY(i) + 0.45 * sag - 0.15 * between * rim, pos.getZ(i) * (1 - 0.05 * sag));
  }
  geo.computeVertexNormals();
  p.add(mesh(geo, std({ map: tex(128, stripes('#f2efe8', '#2b7fb8', ribs * 2)), side: THREE.DoubleSide, roughness: 0.9 }), [0, FLOOR + 11.6, 0]));
  const wood = std({ map: woodTexture('#b78450', '#6b4421', { lines: 20 }), roughness: 0.6 });
  p.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 12.6, 10), wood, [0, FLOOR + 6.3, 0]));
  p.add(mesh(new THREE.SphereGeometry(0.28, 12, 8), wood, [0, FLOOR + 12.6, 0]));
  p.add(mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.5, 16), std({ color: 0xd9d4ca }), [0, FLOOR + 0.25, 0]));
  p.position.set(x, 0, z);
  return p;
}

function lounger(x, z, ry) {
  const l = new THREE.Group();
  const frame = std({ color: 0xe9e5dc, roughness: 0.5 });
  const cushion = std({ color: 0x2d5f86, roughness: 0.95 });
  for (const dx of [-1.3, 1.3]) for (const dz of [-3.6, 3.6]) l.add(mesh(new THREE.BoxGeometry(0.25, 1.4, 0.25), frame, [dx, FLOOR + 0.7, dz]));
  l.add(mesh(slab(3, 8.2, 0.3, 0.2), frame, [0, FLOOR + 1.4, 0.6]));
  l.add(mesh(slab(2.7, 5.4, 0.45, 0.5), cushion, [0, FLOOR + 1.7, 1.8]));
  const back = mesh(slab(2.7, 3, 0.45, 0.5), cushion, [0, FLOOR + 2.4, -2.4]);
  back.rotation.x = 0.7;
  const towel = mesh(slab(1.8, 3.6, 0.06, 0.1), std({ map: tex(64, stripes('#f4f1ea', '#e0874f', 6)), roughness: 1 }), [0.1, FLOOR + 2.18, 2.2]);
  towel.rotation.y = 0.15;
  l.add(back, towel);
  l.position.set(x, 0, z);
  l.rotation.y = ry;
  return l;
}

export function pool(g) {
  g.add(floorPlane(tex(512, R.deckTiles, 20), { roughness: 0.6, under: 0.7 }));
  const w = water();
  g.add(w.mesh, poolEdge(), parasol(-19, -19), parasol(19, -22), lounger(17, -16, -0.5));
  const deck = { wood: ['#d9d3c7', '#a89f8f'], fabric: 0x2d5f86 };
  g.add(chair(-11.5, 0, deck), chair(11.5, Math.PI, deck));
  return {
    background: sky('#5fa8d8', '#d6ecf5'), fog: ['#b4cbd4', 45, 120], hemi: [0xeaf6ff, 0x6a8aa0, 0.9], sun: [0xfff6e0, 2.8], key: [0xfff2dc, 0.6],
    tick: (now) => {
      w.normalMap.offset.set(now * 0.00002, now * 0.000013);
      w.emissiveMap.offset.set(-now * 0.000012, now * 0.000018);
    },
  };
}

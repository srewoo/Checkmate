// The table, the board frame, printed table labels, and the room around them (one module per background).
import * as THREE from './vendor/three.module.min.js';
import { woodTexture } from './pieces3d.js';
import { rnd } from './textures3d.js';
import { FLOOR, std, mesh, roundedRect } from './room-kit.js';
import { indoor } from './room-indoor.js';
import { park } from './room-park.js';
import { office } from './room-office.js';
import { pool } from './room-pool.js';

export const TABLE_Y = -0.15; // table surface
const FILES = 'abcdefgh';

/** Rounded lacquered table with legs and a flower vase (the chess clock lives in clock3d.js). */
export function buildTable() {
  const g = new THREE.Group();
  const SIZE = 19;
  const map = woodTexture('#6a3d22', '#241005', { size: 1024, lines: 150 });
  map.repeat.set(1 / SIZE, 1 / SIZE);
  map.offset.set(0.5, 0.5);
  // no environment map: the table fills a third of the screen and IBL there cost ~20% frame time on a software GPU
  const wood = new THREE.MeshPhysicalMaterial({ map, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  wood.userData.noEnv = true;
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

export function coordinates(ctx, size) {
  const u = size / 9.4; // texture spans the 9.4-unit frame
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#e9c48f';
  ctx.font = `600 ${u * 0.32}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 8; i++) {
    const c = (1.2 + i) * u;
    ctx.fillText(FILES[i], c, size - u * 0.35);
    ctx.fillText(String(8 - i), u * 0.35, c);
  }
}

/** Varnished walnut frame with the file and rank letters printed on its face. */
export function buildFrame() {
  const varnish = { roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.1 };
  const walnut = new THREE.MeshPhysicalMaterial({ map: woodTexture('#3b1f0f', '#150802', { size: 256, lines: 50 }), ...varnish });
  const face = new THREE.MeshPhysicalMaterial({ map: woodTexture('#3b1f0f', '#150802', { size: 1024, lines: 160, draw: coordinates }), ...varnish });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.3, 9.4), [walnut, walnut, face, walnut, walnut, walnut]);
  frame.position.y = -0.05;
  frame.castShadow = frame.receiveShadow = true;
  return frame;
}

/** Text printed on the table, `width` x `depth` units: the status line at the player's edge, or a small badge. */
export function makeLabel(width = 4.8, depth = 0.75) {
  const c = Object.assign(document.createElement('canvas'), { width: Math.round((width / depth) * 160), height: 160 });
  const g = c.getContext('2d');
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.5, depthWrite: false }));
  mesh.receiveShadow = true;
  let shown = null;
  return {
    mesh,
    set(text, flipped, x = 0, z = flipped ? -7.2 : 7.2) {
      mesh.position.set(x, TABLE_Y + 0.01, z);
      mesh.rotation.y = flipped ? Math.PI : 0;
      if (text === shown) return;
      shown = text;
      g.clearRect(0, 0, c.width, c.height);
      let px = 108;
      do g.font = `700 ${px -= 4}px "Iowan Old Style", Palatino, Georgia, serif`; while (g.measureText(text).width > c.width - 44 && px > 40);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = 'rgba(20, 8, 2, 0.45)';
      g.fillText(text, c.width / 2 + 3, 86);
      g.fillStyle = '#f7ecdb';
      g.fillText(text, c.width / 2, 80);
      map.needsUpdate = true;
    },
  };
}

const ROOMS = { indoor, park, office, pool };

/** Room for a background name: {group, background, fog, hemi, sun, key, tick?}. */
export function buildRoom(name) {
  const group = new THREE.Group();
  const env = (ROOMS[name] ?? ROOMS.indoor)(group);
  return { group, ...env };
}

export function disposeTree(root) {
  root.traverse((o) => {
    o.geometry?.dispose();
    for (const m of [o.material].flat().filter(Boolean)) {
      for (const k of ['map', 'bumpMap', 'normalMap', 'emissiveMap']) m[k]?.dispose();
      m.dispose();
    }
  });
}

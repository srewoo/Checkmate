// Office: oak floor and a wool rug, plaster walls over painted wainscoting, a daylit window with a light shaft,
// a bookcase, a framed print, a wall clock, a monstera and a pendant lamp over the table.
import * as THREE from './vendor/three.module.min.js';
import { tex } from './textures3d.js';
import * as R from './textures-rooms.js';
import { FLOOR, WALL, std, mesh, slab, floorPlane, walls, chair, pottedPlant } from './room-kit.js';

const WAINSCOT = 7;

function wainscotPanels(g, s) {
  g.fillStyle = '#56655a';
  g.fillRect(0, 0, s, s);
  const n = 8;
  const w = s / n;
  for (let i = 0; i < n; i++) {
    const x = i * w + w * 0.14;
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(x, s * 0.18, w * 0.72, s * 0.64);
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.fillRect(x + 3, s * 0.18 + 3, w * 0.72 - 6, s * 0.64 - 6);
    g.fillStyle = '#56655a';
    g.fillRect(x + 7, s * 0.18 + 7, w * 0.72 - 14, s * 0.64 - 14);
  }
}

function dial(g, s) {
  g.fillStyle = '#f2ede2';
  g.fillRect(0, 0, s, s);
  g.translate(s / 2, s / 2);
  g.fillStyle = '#2a2622';
  for (let i = 0; i < 12; i++) { g.fillRect(-3, -s * 0.44, 6, s * 0.08); g.rotate(Math.PI / 6); }
  g.lineCap = 'round';
  g.strokeStyle = '#2a2622';
  g.lineWidth = 9; g.beginPath(); g.moveTo(0, 0); g.lineTo(s * 0.2, -s * 0.1); g.stroke();
  g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(-s * 0.05, -s * 0.34); g.stroke();
}

/** Trim and decoration for each wall; `ry` tells which wall this is. */
function trim(side, ry) {
  const paint = std({ color: 0xece6da, roughness: 0.6 });
  const z = -WALL;
  side.add(mesh(new THREE.PlaneGeometry(WALL * 2, WAINSCOT), std({ map: tex(512, wainscotPanels, 2, 1), roughness: 0.6 }), [0, FLOOR + WAINSCOT / 2, z + 0.02], false));
  side.add(mesh(new THREE.BoxGeometry(WALL * 2, 0.9, 0.3), paint, [0, FLOOR + 0.45, z + 0.15], false)); // skirting
  side.add(mesh(new THREE.BoxGeometry(WALL * 2, 0.35, 0.35), paint, [0, FLOOR + WAINSCOT, z + 0.17], false)); // chair rail
  side.add(mesh(new THREE.BoxGeometry(WALL * 2, 0.6, 0.5), paint, [0, FLOOR + 25.7, z + 0.25], false)); // cornice
  if (ry > 0) { // left wall: framed print
    side.add(mesh(new THREE.BoxGeometry(8.6, 6.6, 0.3), std({ color: 0x1f1a16, roughness: 0.5 }), [0, FLOOR + 15, z + 0.15]));
    side.add(mesh(new THREE.PlaneGeometry(7.6, 5.6), std({ map: tex(512, R.art), roughness: 0.9 }), [0, FLOOR + 15, z + 0.32], false));
  } else if (ry < 0) { // right wall: clock
    side.add(mesh(new THREE.CylinderGeometry(2, 2, 0.4, 40).rotateX(Math.PI / 2), std({ color: 0x2a2622, metalness: 0.4, roughness: 0.4 }), [-6, FLOOR + 17, z + 0.2]));
    side.add(mesh(new THREE.CircleGeometry(1.75, 40), std({ map: tex(256, dial), roughness: 0.5 }), [-6, FLOOR + 17, z + 0.42], false));
  }
}

/** Window with frame, mullions and sill, a bright daylight panel, a soft light shaft and a warm patch on the floor. */
function daylightWindow(x) {
  const g = new THREE.Group();
  const z = -WALL;
  const sky = tex(256, (c, s) => {
    const grd = c.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, '#cfe6f5'); grd.addColorStop(1, '#fbf4e4');
    c.fillStyle = grd; c.fillRect(0, 0, s, s);
    c.fillStyle = 'rgba(150,140,125,0.5)';
    for (let y = 0; y < s * 0.35; y += 9) c.fillRect(0, y, s, 4); // blind pulled a third of the way down
  });
  g.add(mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshBasicMaterial({ map: sky, toneMapped: false }), [x, FLOOR + 15, z + 0.04], false));
  const frame = std({ color: 0xf1ece2, roughness: 0.5 });
  for (const [w, h, dx, dy] of [[15, 0.6, 0, 5.2], [15, 0.6, 0, -5.2], [0.6, 11, -7.2, 0], [0.6, 11, 7.2, 0], [0.3, 10, 0, 0], [14, 0.3, 0, 1.2]]) {
    g.add(mesh(new THREE.BoxGeometry(w, h, 0.5), frame, [x + dx, FLOOR + 15 + dy, z + 0.25], false));
  }
  g.add(mesh(new THREE.BoxGeometry(16, 0.35, 1.4), frame, [x, FLOOR + 9.6, z + 0.6]));
  const glow = (alpha) => tex(128, (c, s) => {
    const grd = c.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, `rgba(255,236,200,${alpha})`); grd.addColorStop(1, 'rgba(255,236,200,0)');
    c.fillStyle = grd; c.fillRect(0, 0, s, s);
  });
  const additive = (map, opacity) => new THREE.MeshBasicMaterial({ map, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const shaft = mesh(new THREE.PlaneGeometry(13, 26), additive(glow(0.5), 0.16), [x - 1, FLOOR + 8, z + 9], false);
  shaft.rotation.x = -0.75;
  const patch = mesh(new THREE.PlaneGeometry(14, 10).rotateX(-Math.PI / 2), additive(glow(0.6), 0.4), [x - 1, FLOOR + 0.05, z + 15], false);
  g.add(shaft, patch);
  return g;
}

function bookcase(x) {
  const g = new THREE.Group();
  const wood = std({ color: 0x3b2a1d, roughness: 0.6 });
  g.add(mesh(new THREE.BoxGeometry(12, 15, 0.4), std({ map: tex(512, R.shelves) }), [0, FLOOR + 7.5, -0.8]));
  for (const dx of [-5.9, 5.9]) g.add(mesh(new THREE.BoxGeometry(0.4, 15, 2), wood, [dx, FLOOR + 7.5, 0]));
  for (let i = 0; i <= 4; i++) g.add(mesh(new THREE.BoxGeometry(12, 0.35, 2), wood, [0, FLOOR + 0.2 + i * 3.6, 0]));
  g.position.set(x, 0, -WALL + 1.1);
  return g;
}

function pendant() {
  const g = new THREE.Group();
  const y = FLOOR + 26.5; // hung high so the shade never covers the board from the default seat
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 6), std({ color: 0x111111 }), [0, y - 1, 0], false));
  const shade = new THREE.LatheGeometry([[0.3, 0], [0.5, 0.1], [2.4, -1.6], [2.5, -1.7]].map(([a, b]) => new THREE.Vector2(a, b)), 32);
  g.add(mesh(shade, std({ color: 0x1d2a26, metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide }), [0, y - 2, 0], false));
  g.add(mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false }), [0, y - 3.2, 0], false));
  return g;
}

export function office(g) {
  g.add(floorPlane(tex(1024, R.planks, 8), { roughness: 0.55, under: 0.7 }));
  const rug = tex(1024, R.rug, 1 / 36, 1 / 30); // extruded UVs are in world units
  rug.offset.set(0.5, 0.5);
  g.add(mesh(slab(36, 30, 0.12, 0.3), std({ map: rug, roughness: 1 }), [0, FLOOR, 0], false));
  g.add(walls(std({ map: tex(512, R.plaster('#cfc6b6'), 5, 3), roughness: 0.95 }), trim));
  g.add(daylightWindow(7), bookcase(-15), pendant());
  const plant = pottedPlant({ wide: true, height: 5, count: 26, color: 0x355e31 });
  plant.position.set(WALL - 5, 0, -WALL + 5);
  plant.scale.setScalar(1.4);
  g.add(plant, chair(-11.5, 0, { wood: ['#6b4428', '#2e1a0c'], fabric: 0x4f5d6b }), chair(11.5, Math.PI, { wood: ['#6b4428', '#2e1a0c'], fabric: 0x4f5d6b }));
  return {
    background: new THREE.Color('#6d665c'), fog: ['#6d665c', 38, 105],
    hemi: [0xfff4e6, 0x3c3630, 0.7], sun: [0xfff1dc, 1.7], key: [0xffd49a, 1.5],
  };
}

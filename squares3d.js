// The 64 varnished squares plus their overlays: highlights, quiet-move dots, capture rings, hover/keyboard cursor.
import * as THREE from './vendor/three.module.min.js';
import { woodTexture } from './pieces3d.js';

export const FILES = 'abcdefgh';
export const TOP = 0.12; // y of the square surface
export const at = (sq) => new THREE.Vector3(FILES.indexOf(sq[0]) - 3.5, TOP, 3.5 - (Number(sq[1]) - 1));
export const COLORS = { sel: 0x2f9a3e, last: 0xe8aa3c, check: 0xff3b2b, hover: 0xffd27a };

/** Tiles, highlight overlays, quiet-move dots, capture rings and the hover cursor. */
export function buildSquares(scene) {
  const tiles = [];
  const overlays = new Map();
  const dots = new Map();
  const rings = new Map();
  const varnish = { roughness: 0.5, clearcoat: 0.9, clearcoatRoughness: 0.12 };
  const tileMats = [0, 1, 2, 3].flatMap((i) => [
    new THREE.MeshPhysicalMaterial({ map: woodTexture('#f1c48a', '#b06e36', { lines: 30 }), ...varnish }),
    new THREE.MeshPhysicalMaterial({ map: woodTexture('#6e4127', '#2a1408', { lines: 30 }), ...varnish }),
  ].map((m) => { m.map.rotation = i * 1.3; m.map.offset.set(i * 0.31, i * 0.17); return m; }));
  const tileGeo = new THREE.BoxGeometry(0.96, 0.14, 0.96);
  const overGeo = new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2);
  const dotGeo = new THREE.CircleGeometry(0.17, 32).rotateX(-Math.PI / 2);
  const ringGeo = new THREE.RingGeometry(0.38, 0.48, 48).rotateX(-Math.PI / 2);
  const flat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false }); // markers keep their true colour
  const dotMat = flat(0x2f9a3e, 0.8);
  const ringMat = flat(0xd23a2c, 0.9);
  const marker = (geo, mat, p, y) => Object.assign(new THREE.Mesh(geo, mat), { visible: false, renderOrder: 2 }).translateX(p.x).translateY(y).translateZ(p.z);
  for (let f = 0; f < 8; f++) {
    for (let r = 0; r < 8; r++) {
      const sq = FILES[f] + (r + 1);
      const p = at(sq);
      const tile = new THREE.Mesh(tileGeo, tileMats[((f * 3 + r * 5) % 4) * 2 + ((f + r) % 2 ? 0 : 1)]);
      tile.position.set(p.x, TOP - 0.07, p.z);
      tile.receiveShadow = true; // flush tiles never cast a visible shadow
      tile.userData.sq = sq;
      tiles.push(tile);
      overlays.set(sq, marker(overGeo, flat(0xffffff, 0.6), p, TOP + 0.003));
      dots.set(sq, marker(dotGeo, dotMat, p, TOP + 0.006));
      rings.set(sq, marker(ringGeo, ringMat, p, TOP + 0.006));
      scene.add(tile, overlays.get(sq), dots.get(sq), rings.get(sq));
    }
  }
  // square outline (a 4-segment ring turned 45 degrees), dark outside and amber inside so it reads on both square colours
  const outline = (r0, r1) => new THREE.RingGeometry(r0, r1, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2);
  const hover = marker(outline(0.6, 0.68), flat(0x1a0d05, 0.5), new THREE.Vector3(), TOP + 0.005);
  hover.add(Object.assign(new THREE.Mesh(outline(0.5, 0.6), flat(COLORS.hover, 0.5)), { renderOrder: 2 }));
  scene.add(hover);
  return { tiles, tileMats, overlays, dots, rings, hover };
}

// Indoor courtyard at golden hour: flagstones, brick walls behind a timber trellis, stone planters along the walls,
// a potted olive and a lemon tree, and strings of warm festoon lights overhead.
import * as THREE from './vendor/three.module.min.js';
import { tex, bricks, rnd, sky } from './textures3d.js';
import * as R from './textures-rooms.js';
import { FLOOR, WALL, std, mesh, slab, floorPlane, walls, chair, crown } from './room-kit.js';

function trellis(side) {
  const beam = std({ color: 0x2b1a10, roughness: 0.7 });
  for (let x = -WALL; x <= WALL; x += 4.5) side.add(mesh(new THREE.BoxGeometry(0.45, 26, 0.45), beam, [x, FLOOR + 13, -WALL + 0.5], false));
  for (const y of [6, 13, 20]) side.add(mesh(new THREE.BoxGeometry(WALL * 2, 0.45, 0.45), beam, [0, FLOOR + y, -WALL + 0.6], false));
  // raised stone planter along the wall, filled with shrubs
  const stone = std({ map: tex(512, R.flagstones, 6, 0.4), roughness: 0.9 });
  side.add(mesh(new THREE.BoxGeometry(WALL * 2 - 6, 2.2, 3), stone, [0, FLOOR + 1.1, -WALL + 2]));
  side.add(mesh(slab(WALL * 2 - 5.4, 3.6, 0.35, 0.2), std({ color: 0xbdb3a2, roughness: 0.8 }), [0, FLOOR + 2.2, -WALL + 2]));
  for (let x = -WALL + 6; x < WALL - 4; x += 7) {
    const shrub = crown(40, 1.8, 0, 0x4a6a34, 1); // few large leaves: leaf overdraw is the main cost here
    shrub.position.set(x + rnd(-1, 1), FLOOR + 3.4, -WALL + 2);
    side.add(shrub);
  }
}

function terracotta(r = 1.6, h = 2.6) {
  const pts = [[0, 0], [r * 0.7, 0], [r, h * 0.85], [r * 1.12, h], [r * 1.02, h]].map(([x, y]) => new THREE.Vector2(x, y));
  return mesh(new THREE.LatheGeometry(pts, 24), std({ color: 0xa65a3a, roughness: 0.9 }), [0, FLOOR, 0]);
}

/** Pot, gnarled trunk, a leafy crown; `fruit` adds yellow lemons. */
function pottedTree({ leaf, fruit = false, height = 9 }) {
  const t = new THREE.Group();
  t.add(terracotta());
  const bark = std({ color: 0x5d4a38, roughness: 0.95 });
  let base = new THREE.Vector3(0, FLOOR + 2.4, 0);
  for (let i = 0; i < 3; i++) {
    const top = base.clone().add(new THREE.Vector3(rnd(-0.6, 0.6), height / 3, rnd(-0.6, 0.6)));
    const seg = mesh(new THREE.CylinderGeometry(0.22 - i * 0.04, 0.3 - i * 0.04, base.distanceTo(top), 7), bark, [(base.x + top.x) / 2, (base.y + top.y) / 2, (base.z + top.z) / 2]);
    seg.lookAt(top); seg.rotateX(Math.PI / 2);
    t.add(seg);
    base = top;
  }
  t.add(crown(320, 3.2, base.y, leaf, 0.7));
  if (fruit) {
    const lemons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 10, 8).scale(1, 1.25, 1), std({ color: 0xe8c43a, roughness: 0.5 }), 14);
    const d = new THREE.Object3D();
    for (let i = 0; i < 14; i++) {
      const a = rnd(0, Math.PI * 2);
      d.position.set(Math.cos(a) * rnd(1.8, 3), base.y + rnd(-1.5, 1.2), Math.sin(a) * rnd(1.8, 3));
      d.updateMatrix();
      lemons.setMatrixAt(i, d.matrix);
    }
    t.add(lemons);
  }
  return t;
}

/** Sagging strands of glowing bulbs between the side walls. */
function festoon(z, y, sag) {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([-1, -0.5, 0, 0.5, 1].map((k) => new THREE.Vector3(k * (WALL - 1), y - sag * (1 - k * k), z + k * 2)));
  g.add(mesh(new THREE.TubeGeometry(curve, 48, 0.04, 4), std({ color: 0x111111 }), [0, 0, 0], false));
  const n = 28;
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd08a, toneMapped: false }), n);
  const d = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    d.position.copy(curve.getPoint((i + 0.5) / n)).y -= 0.3;
    d.updateMatrix();
    bulbs.setMatrixAt(i, d.matrix);
  }
  g.add(bulbs);
  return g;
}

export function indoor(g) {
  g.add(floorPlane(tex(1024, R.flagstones, 16), { bump: 3, roughness: 0.9, under: 0.6 }));
  g.add(walls(std({ map: tex(512, bricks, 7, 3.2) }), trellis));
  const olive = pottedTree({ leaf: 0x7d8c63 });
  olive.position.set(-17, 0, -14);
  const lemon = pottedTree({ leaf: 0x3f6a2e, fruit: true, height: 8 });
  lemon.position.set(18, 0, -16);
  g.add(olive, lemon, festoon(-16, FLOOR + 15.5, 2.2), festoon(-25, FLOOR + 16.5, 2));
  const linen = { wood: ['#9c6a3e', '#4e3018'], fabric: 0xd8cfbd };
  g.add(chair(-11.5, 0, linen), chair(11.5, Math.PI, linen));
  return {
    background: sky('#4e6378', '#d8b58c'),
    fog: ['#6f6253', 40, 110], hemi: [0xffe9cf, 0x3a2e24, 0.75], sun: [0xffcf9a, 2.2], key: [0xffd49a, 1.3],
  };
}

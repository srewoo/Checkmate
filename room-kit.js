// Shared building blocks for the rooms: floor, walls, a cushioned wooden chair, leafy plants and tree canopies.
// Foliage is one InstancedMesh per plant (one draw call) made of thin bent leaf shapes.
import * as THREE from './vendor/three.module.min.js';
import { woodTexture } from './pieces3d.js';
import { rnd } from './textures3d.js';

export const FLOOR = -9.6;
export const WALL = 28; // distance from the table to each wall

export const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
export function mesh(geo, material, [x, y, z] = [0, 0, 0], shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

export function roundedRect(w, d, r) {
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

/** A soft rounded slab (cushion, rug, stone coping), `h` thick, lying flat with its base at y = 0. */
export function slab(w, d, h, r = Math.min(w, d) * 0.2) {
  const b = Math.min(h * 0.45, r * 0.8);
  return new THREE.ExtrudeGeometry(roundedRect(w - 2 * b, d - 2 * b, Math.max(0.01, r - b)), {
    depth: Math.max(0.01, h - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 6,
  }).rotateX(-Math.PI / 2).translate(0, b, 0);
}

/**
 * Big floor plane with vertex colours: slow tonal drift breaks up texture tiling, and it darkens under the table
 * (cheap ambient occlusion). `bump` reuses the colour map as a height map for relief.
 */
export function floorPlane(map, { bump = 0, roughness = 0.85, size = 160, under = 0.6 } = {}) {
  const geo = new THREE.PlaneGeometry(size, size, 48, 48).rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const drift = 0.88 + 0.12 * Math.sin(x * 0.11 + Math.sin(z * 0.07) * 2) * Math.cos(z * 0.09 - x * 0.03);
    const r = Math.hypot(x, z);
    const ao = r < 14 ? under + (1 - under) * THREE.MathUtils.smoothstep(r, 5, 14) : 1;
    colors.fill(drift * ao, i * 3, i * 3 + 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const m = std({ map, vertexColors: true, roughness, ...(bump ? { bumpMap: map, bumpScale: bump } : {}) });
  return mesh(geo, m, [0, FLOOR, 0], false);
}

/** The same wall (plus anything `extra` adds) on the back, left and right sides. */
export function walls(material, extra, height = 26) {
  const g = new THREE.Group();
  for (const ry of [0, Math.PI / 2, -Math.PI / 2]) {
    const side = new THREE.Group();
    side.add(mesh(new THREE.PlaneGeometry(WALL * 2, height), material, [0, FLOOR + height / 2, -WALL], false));
    extra?.(side, ry);
    side.rotation.y = ry;
    g.add(side);
  }
  return g;
}

/** Classic wooden dining chair: tapered square legs, a cushioned seat and an upholstered back. */
export function chair(z, ry, { wood = ['#a8703f', '#5e3a1c'], fabric = 0xb9b2a4 } = {}) {
  const c = new THREE.Group();
  const w = std({ map: woodTexture(wood[0], wood[1], { lines: 30 }), roughness: 0.5 });
  const cloth = std({ color: fabric, roughness: 0.95 });
  const seatY = FLOOR + 5.2;
  const leg = (h) => new THREE.CylinderGeometry(0.22, 0.3, h, 4).rotateY(Math.PI / 4);
  for (const [x, zz] of [[-2.5, -2.3], [2.5, -2.3], [-2.5, 2.3], [2.5, 2.3]]) c.add(mesh(leg(5.2), w, [x, FLOOR + 2.6, zz]));
  c.add(mesh(slab(5.8, 5.4, 0.45, 0.3), w, [0, seatY - 0.45, 0]));
  c.add(mesh(slab(5.4, 5, 0.7, 0.9), cloth, [0, seatY, 0.1]));
  for (const x of [-2.55, 2.55]) {
    const post = mesh(new THREE.CylinderGeometry(0.2, 0.26, 6, 4).rotateY(Math.PI / 4), w, [x, seatY + 2.9, -2.45]);
    post.rotation.x = -0.1;
    c.add(post);
  }
  const back = mesh(slab(4.9, 3.2, 0.6, 0.8).rotateX(Math.PI / 2), cloth, [0, seatY + 4.5, -2.55]);
  back.rotation.x = -0.1;
  c.add(back, mesh(new THREE.BoxGeometry(5.6, 0.45, 0.5), w, [0, seatY + 6.2, -2.95]));
  c.position.z = z;
  c.rotation.y = ry;
  return c;
}

/** Leaf: a pointed oval, folded along its midrib and curled down at the tip. Base at the origin, tip towards +y. */
function leafGeometry(len, width) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(width, len * 0.4, 0, len);
  s.quadraticCurveTo(-width, len * 0.4, 0, 0);
  const geo = new THREE.ShapeGeometry(s, 5);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    p.setZ(i, Math.abs(x) * 0.5 + (y / len) ** 2 * len * 0.35);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Instanced leaves; `place(i, dummy)` sets each leaf's transform. Colour varies a little per leaf. */
export function leaves(count, len, width, color, place) {
  const mat = std({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.7 });
  const m = new THREE.InstancedMesh(leafGeometry(len, width), mat, count);
  const d = new THREE.Object3D();
  const base = new THREE.Color(color);
  const tint = new THREE.Color();
  for (let i = 0; i < count; i++) {
    d.position.set(0, 0, 0);
    d.rotation.set(0, 0, 0);
    d.scale.setScalar(1);
    place(i, d);
    d.updateMatrix();
    m.setMatrixAt(i, d.matrix);
    m.setColorAt(i, tint.copy(base).offsetHSL(rnd(-0.02, 0.02), rnd(-0.05, 0.05), rnd(-0.06, 0.06)));
  }
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Leaves spread over a dome (a shrub or a tree crown) of `radius` centred at `y`. */
export function crown(count, radius, y, color, len = 0.9) {
  return leaves(count, len, len * 0.4, color, (i, d) => {
    const u = rnd(0, Math.PI * 2);
    const v = Math.acos(rnd(-0.4, 1));
    const r = radius * Math.cbrt(rnd(0.35, 1));
    d.position.set(Math.sin(v) * Math.cos(u) * r, y + Math.cos(v) * r * 0.8, Math.sin(v) * Math.sin(u) * r);
    d.rotation.set(rnd(-1.4, 0.2), u + Math.PI / 2, rnd(-0.6, 0.6));
    d.scale.setScalar(rnd(0.7, 1.3));
  });
}

/** Potted plant: arching leaves on stems from the pot rim (monstera-ish when `wide`). */
export function pottedPlant({ potColor = 0xe2dccf, height = 4, count = 34, wide = false, color = 0x3f6b33 } = {}) {
  const g = new THREE.Group();
  const pot = new THREE.LatheGeometry([[0, 0], [1.1, 0], [1.4, 2.4], [1.5, 2.6], [1.3, 2.6]].map(([x, y]) => new THREE.Vector2(x, y)), 24);
  g.add(mesh(pot, std({ color: potColor, roughness: 0.6 }), [0, FLOOR, 0]));
  g.add(mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.1, 20), std({ color: 0x2b2018 }), [0, FLOOR + 2.4, 0], false));
  const len = wide ? 1.9 : 1.4;
  g.add(leaves(count, len, len * (wide ? 0.6 : 0.32), color, (i, d) => {
    const a = (i / count) * Math.PI * 2 * 3.1 + rnd(-0.2, 0.2);
    const reach = rnd(0.2, 1);
    d.position.set(Math.cos(a) * reach, FLOOR + 2.5 + rnd(0.3, height), Math.sin(a) * reach);
    d.rotation.set(-rnd(0.5, 1.3), Math.atan2(-Math.cos(a), -Math.sin(a)), 0, 'YXZ'); // tip outwards along angle a
    d.scale.setScalar(rnd(0.7, 1.2));
  }));
  return g;
}

// Short-lived particle effects: a dust puff on captures and confetti on checkmate. Each effect is one draw call.
import * as THREE from './vendor/three.module.min.js';
import { calm } from './motion3d.js';

const dummy = new THREE.Object3D();
const GRAVITY = 9.8;

/** Instanced particles with per-particle velocity and spin; removes and disposes itself when done. */
function burst(scene, { count, geo, colors, origin, spread, speed, up, life, spin }) {
  const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const parts = Array.from({ length: count }, (_, i) => {
    mesh.setColorAt(i, new THREE.Color(colors[i % colors.length]));
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.6);
    return {
      p: origin.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * 0.1, (Math.random() - 0.5) * spread)),
      v: new THREE.Vector3(Math.cos(a) * v, up * (0.5 + Math.random() * 0.5), Math.sin(a) * v),
      r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      w: (Math.random() - 0.5) * spin,
    };
  });
  mesh.frustumCulled = false;
  scene.add(mesh);
  const t0 = performance.now();
  let prev = t0;
  return (now) => {
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    const k = (now - t0) / (life * 1000);
    if (k >= 1) { scene.remove(mesh); mesh.dispose(); mat.dispose(); return false; }
    mat.opacity = Math.min(1, (1 - k) * 2.5);
    parts.forEach((q, i) => {
      q.v.y -= GRAVITY * dt * (spin ? 0.3 : 0.02); // confetti flutters; dust barely falls
      q.v.multiplyScalar(spin ? 0.985 : 0.93);
      q.p.addScaledVector(q.v, dt);
      const floor = Math.abs(q.p.x) < 4.7 && Math.abs(q.p.z) < 4.7 ? 0.13 : -0.14; // board top or table top
      if (spin && q.p.y < floor) { q.p.y = floor; q.v.set(0, 0, 0); q.w = 0; q.r.x = Math.PI / 2; q.r.y = 0; }
      q.r.x += q.w * dt;
      q.r.y += q.w * dt * 0.7;
      dummy.position.copy(q.p);
      dummy.rotation.copy(q.r);
      dummy.scale.setScalar(spin ? 1 : 1 + k * 2.5);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return true;
  };
}

const dustGeo = new THREE.IcosahedronGeometry(0.05, 0);
const confettiGeo = new THREE.PlaneGeometry(0.17, 0.1);
const GOLD = [0xf2c14e, 0xe8a33c];

export function createFx(scene) {
  let live = [];
  const add = (make) => { if (!calm()) live.push(make()); };
  return {
    dust(at) {
      add(() => burst(scene, { count: 32, geo: dustGeo, colors: [0xe8d6b8, 0xcdb28a, 0xf6ecdc], origin: at, spread: 0.6, speed: 2.2, up: 1.2, life: 0.8, spin: 0 }));
    },
    confetti(winner) {
      const team = winner === 'w' ? [0xf7ecd6, 0xfffaf0] : [0x3b2a20, 0x1f1611];
      add(() => burst(scene, {
        count: 180, geo: confettiGeo, colors: [...team, ...GOLD, 0xc0392b, 0x2e86c1], origin: new THREE.Vector3(0, 4.5, 0),
        spread: 5, speed: 3.2, up: 3.5, life: 5, spin: 14,
      }));
    },
    tick(now) { live = live.filter((step) => step(now)); },
  };
}

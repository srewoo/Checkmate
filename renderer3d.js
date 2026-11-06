// WebGL renderer and image-based lighting for the 3D board.
import * as THREE from './vendor/three.module.min.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  // supersample 1x screens (pieces are ~30px tall); frame() drops back to native if the GPU can't keep up
  renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio, 1.5), 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps the walnut brown where ACES pushed it pink
  renderer.toneMappingExposure = 1.08;
  container.append(renderer.domElement);
  return renderer;
}

/** Image-based lighting from a procedural studio room, so lacquer and varnish pick up soft reflections. */
export function environment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const tex = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  return tex;
}

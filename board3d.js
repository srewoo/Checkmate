// WebGL board: room + table, board, pieces, captured-piece rows, turn label, orbit camera, click-to-square.
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { makePiece, woodTexture } from './pieces3d.js';
import { buildTable, buildRoom, disposeTree, TABLE_Y } from './scene3d.js';

const FILES = 'abcdefgh';
const TOP = 0.12; // y of the square surface
const at = (sq) => new THREE.Vector3(FILES.indexOf(sq[0]) - 3.5, TOP, 3.5 - (Number(sq[1]) - 1));
const COLORS = { sel: 0x2f9a3e, hit: 0xc0281f, last: 0xe8aa3c, check: 0xff3b2b };
const START = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

// Captured pieces stand in two rows in front of the player who took them.
function graveSpot(color, i) {
  const side = color === 'b' ? 1 : -1;
  return new THREE.Vector3(((i % 8) - 3.5) * side, TABLE_Y, side * (5.55 + Math.floor(i / 8) * 0.8));
}

function coordinates(ctx, size) {
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

function buildFrame() {
  const walnut = new THREE.MeshStandardMaterial({ map: woodTexture('#3b1f0f', '#150802', { size: 256, lines: 50 }), roughness: 0.4 });
  const face = new THREE.MeshStandardMaterial({ map: woodTexture('#3b1f0f', '#150802', { size: 1024, lines: 160, draw: coordinates }), roughness: 0.4 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.3, 9.4), [walnut, walnut, face, walnut, walnut, walnut]);
  frame.position.y = -0.05;
  frame.castShadow = frame.receiveShadow = true;
  return frame;
}

/** Big status text lying on the table at the player's edge. */
function makeLabel() {
  const c = Object.assign(document.createElement('canvas'), { width: 1024, height: 160 });
  const g = c.getContext('2d');
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.25).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.5, depthWrite: false }));
  mesh.receiveShadow = true;
  let shown = null;
  return {
    mesh,
    set(text, flipped) {
      mesh.position.set(0, TABLE_Y + 0.01, flipped ? -7.7 : 7.7);
      mesh.rotation.y = flipped ? Math.PI : 0;
      if (text === shown) return;
      shown = text;
      g.clearRect(0, 0, c.width, c.height);
      let px = 108;
      do g.font = `700 ${px -= 4}px "Iowan Old Style", Palatino, Georgia, serif`; while (g.measureText(text).width > 980 && px > 40);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = 'rgba(20, 8, 2, 0.45)';
      g.fillText(text, 515, 86);
      g.fillStyle = '#f7ecdb';
      g.fillText(text, 512, 80);
      map.needsUpdate = true;
    },
  };
}

export function createBoard3D(container, onSquare, onOrbit) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enablePan: false, enableDamping: true, minDistance: 7, maxDistance: 30, maxPolarAngle: 1.38, minPolarAngle: 0.05 });
  controls.addEventListener('start', () => onOrbit?.());

  const hemi = new THREE.HemisphereLight(0xfff1dc, 0x3a2614, 1.1);
  const sun = new THREE.DirectionalLight(0xffe0b0, 2.4);
  sun.position.set(9, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, far: 80 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  const fill = new THREE.DirectionalLight(0xa8c0ff, 0.45);
  fill.position.set(-8, 8, -6);
  const label = makeLabel();
  scene.add(hemi, sun, fill, buildTable(), buildFrame(), label.mesh);

  let room = null;
  let roomName = null;
  function setScene(name) {
    if (name === roomName) return;
    roomName = name;
    if (room) { scene.remove(room.group); disposeTree(room.group); }
    room = buildRoom(name);
    scene.add(room.group);
    scene.background = room.background;
    scene.fog = new THREE.Fog(...room.fog);
    hemi.color.setHex(room.hemi[0]);
    hemi.groundColor.setHex(room.hemi[1]);
    hemi.intensity = room.hemi[2];
    sun.color.setHex(room.sun[0]);
    sun.intensity = room.sun[1];
  }

  // squares (raised blocks with a hairline gap), highlight overlays, move-target dots
  const tiles = [];
  const overlays = new Map();
  const dots = new Map();
  const tileMats = [0, 1, 2, 3].flatMap((i) => [
    new THREE.MeshStandardMaterial({ map: woodTexture('#f1c48a', '#b06e36', { lines: 30 }), roughness: 0.45 }),
    new THREE.MeshStandardMaterial({ map: woodTexture('#6e4127', '#2a1408', { lines: 30 }), roughness: 0.45 }),
  ].map((m) => { m.map.rotation = i * 1.3; m.map.offset.set(i * 0.31, i * 0.17); return m; }));
  const tileGeo = new THREE.BoxGeometry(0.96, 0.14, 0.96);
  const overGeo = new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2);
  const dotGeo = new THREE.CircleGeometry(0.15, 24).rotateX(-Math.PI / 2);
  for (let f = 0; f < 8; f++) {
    for (let r = 0; r < 8; r++) {
      const sq = FILES[f] + (r + 1);
      const p = at(sq);
      const tile = new THREE.Mesh(tileGeo, tileMats[((f * 3 + r * 5) % 4) * 2 + ((f + r) % 2 ? 0 : 1)]);
      tile.position.set(p.x, TOP - 0.07, p.z);
      tile.castShadow = tile.receiveShadow = true;
      tile.userData.sq = sq;
      tiles.push(tile);
      const o = new THREE.Mesh(overGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, depthWrite: false }));
      o.position.set(p.x, TOP + 0.004, p.z);
      o.visible = false;
      overlays.set(sq, o);
      const d = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0x2f9a3e, transparent: true, opacity: 0.9 }));
      d.position.set(p.x, TOP + 0.006, p.z);
      d.visible = false;
      dots.set(sq, d);
      scene.add(tile, o, d);
    }
  }

  // ---- animation ----
  let tweens = [];
  const tween = (obj, to, { dur = 0.38, lift = 0, scale, onDone } = {}) => {
    tweens = tweens.filter((t) => t.obj !== obj);
    tweens.push({ obj, from: obj.position.clone(), to, t0: performance.now(), dur: dur * 1000, lift, s0: obj.scale.x, scale, onDone });
  };
  function stepTweens(now) {
    tweens = tweens.filter((t) => {
      const k = Math.min(1, (now - t.t0) / t.dur);
      const e = ease(k);
      t.obj.position.lerpVectors(t.from, t.to, e);
      t.obj.position.y += Math.sin(Math.PI * e) * t.lift;
      if (t.scale !== undefined) t.obj.scale.setScalar(t.s0 + (t.scale - t.s0) * e);
      if (k < 1) return true;
      t.onDone?.();
      return false;
    });
  }
  const sink = (g) => tween(g, g.position.clone().setY(g.position.y - 0.4), { dur: 0.3, scale: 0.01, onDone: () => scene.remove(g) });
  const take = (list, pred, fromEnd = false) => {
    const i = fromEnd ? list.findLastIndex(pred) : list.findIndex(pred);
    return i < 0 ? null : list.splice(i, 1)[0];
  };

  // ---- pieces: diff the position against what's on screen so moves, captures, castling, undo and resets all animate ----
  let pieces = new Map();
  let grave = []; // captured pieces, in capture order
  function syncPieces(chess, last) {
    const want = new Map();
    for (const row of chess.board()) for (const p of row) if (p) want.set(p.square, p.color + p.type);
    const keep = new Map();
    const spare = [];
    for (const [sq, g] of pieces) (want.get(sq) === g.userData.key ? keep.set(sq, g) : spare.push(g));
    for (const [sq, key] of want) {
      if (keep.has(sq)) continue;
      const same = (g) => g.userData.key === key;
      let g = take(spare, (x) => same(x) && x.userData.sq === last?.from) ?? take(spare, same) ?? take(grave, same, true);
      if (g) {
        const d = g.position.distanceTo(at(sq));
        tween(g, at(sq), { lift: key[1] === 'n' ? 0.9 : Math.min(1, 0.2 + d * 0.1), dur: 0.3 + Math.min(0.4, d * 0.05) });
      } else {
        g = makePiece(key[1], key[0]);
        g.position.copy(sq === last?.to && last.promotion ? at(last.from) : at(sq).add(new THREE.Vector3(0, 2.5, 0)));
        scene.add(g);
        tween(g, at(sq), { lift: 0.3 });
      }
      g.userData.sq = sq;
      g.userData.slot = null;
      keep.set(sq, g);
    }
    pieces = keep;

    // graveyard: keep only what's actually missing from the board (drops promoted pawns' queens, resets, etc.)
    grave.push(...spare);
    const onBoard = {};
    for (const key of want.values()) onBoard[key] = (onBoard[key] ?? 0) + 1;
    const seen = {};
    grave = grave.filter((g) => {
      const k = g.userData.key;
      seen[k] = (seen[k] ?? 0) + 1;
      if (seen[k] <= START[k[1]] - (onBoard[k] ?? 0)) return true;
      sink(g);
      return false;
    });
    const count = { w: 0, b: 0 };
    for (const g of grave) {
      const color = g.userData.key[0];
      const slot = color + count[color];
      const spot = graveSpot(color, count[color]++);
      if (g.userData.slot === slot) continue;
      g.userData.slot = slot;
      g.userData.sq = null;
      tween(g, spot, { lift: 1.2, dur: 0.6 });
    }
  }

  // ---- camera: seated at the player's side, looking down at about 46° ----
  let flipped = null;
  let camTween = null;
  function homeCamera(animate) {
    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    camera.fov = aspect < 0.9 ? 50 : 40;
    camera.updateProjectionMatrix();
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(7.6 / (t * aspect), 11 / t); // board, captured rows, label and a slice of the room
    const s = flipped ? -1 : 1;
    const to = new THREE.Vector3(0, dist * 0.72, dist * 0.69 * s);
    const target = new THREE.Vector3(0, 0, (aspect < 0.9 ? 2.2 : 3.2) * s); // nudged so the label clears the bottom panel
    if (!animate) { camera.position.copy(to); controls.target.copy(target); return; }
    camTween = { from: camera.position.clone(), to, fromT: controls.target.clone(), target, t0: performance.now() };
  }

  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(() => { resize(); homeCamera(false); }).observe(container);

  // ---- input: a click is a pointer press that didn't drag the camera ----
  const ray = new THREE.Raycaster();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects([...pieces.values(), ...tiles], true)[0];
    let o = hit?.object;
    while (o && !o.userData.sq) o = o.parent;
    if (o) onSquare(o.userData.sq);
  });
  renderer.domElement.addEventListener('dblclick', () => homeCamera(true));

  function frame(now) {
    stepTweens(now);
    room?.tick?.(now);
    if (camTween) {
      const k = Math.min(1, (now - camTween.t0) / 800);
      camera.position.lerpVectors(camTween.from, camTween.to, ease(k));
      controls.target.lerpVectors(camTween.fromT, camTween.target, ease(k));
      if (k === 1) camTween = null;
    }
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  resize();
  requestAnimationFrame(frame);

  return {
    setScene,
    /** Same view object the 2D board uses; `status` is printed on the table. */
    render(chess, view, status) {
      if (flipped !== view.flipped) { const first = flipped === null; flipped = view.flipped; homeCamera(!first); }
      label.set(status, flipped);
      let checkSq = null;
      if (chess.inCheck()) for (const row of chess.board()) for (const p of row) if (p?.type === 'k' && p.color === chess.turn()) checkSq = p.square;
      for (const [sq, o] of overlays) {
        const kind = sq === view.selected ? 'sel' : view.targets.get(sq) ? 'hit' : sq === checkSq ? 'check' : view.last && (sq === view.last.from || sq === view.last.to) ? 'last' : null;
        o.visible = Boolean(kind);
        if (kind) { o.material.color.setHex(COLORS[kind]); o.material.opacity = kind === 'last' ? 0.4 : 0.7; }
        dots.get(sq).visible = view.targets.get(sq) === false;
      }
      syncPieces(chess, view.last);
    },
  };
}

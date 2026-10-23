// WebGL board: room + table, board, pieces, captured-piece rows, turn label, orbit camera, click/keyboard-to-square.
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { makePiece, setGlow, glowMaterials, pieceMaterials } from './pieces3d.js';
import { FILES, TOP, at, COLORS, buildSquares } from './squares3d.js';
import { createInput } from './input3d.js';
import { buildTable, buildRoom, buildFrame, makeLabel, coordinates, disposeTree, TABLE_Y } from './scene3d.js';
import { createThemes } from './themes3d.js';
import { materialBalance } from './result.js';
import { createMotion, calm, ease } from './motion3d.js';
import { createFx } from './fx3d.js';
import { createClock } from './clock3d.js';
import { fitView } from './camera3d.js';

const START = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
const onBoardXZ = (p) => Math.abs(p.x) < 4.7 && Math.abs(p.z) < 4.7;

// Captured pieces stand in two rows in front of the player who took them.
function graveSpot(color, i) {
  const side = color === 'b' ? 1 : -1;
  return new THREE.Vector3(((i % 8) - 3.5) * side, TABLE_Y, side * (5.55 + Math.floor(i / 8) * 0.8));
}

function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps the walnut brown where ACES pushed it pink
  renderer.toneMappingExposure = 1.08;
  container.append(renderer.domElement);
  return renderer;
}

/** Image-based lighting from a procedural studio room, so lacquer and varnish pick up soft reflections. */
function environment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const tex = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  return tex;
}

export function createBoard3D(container, onSquare, onOrbit) {
  const renderer = createRenderer(container);
  const scene = new THREE.Scene();
  const envMap = environment(renderer);
  // Only lacquered/varnished (physical) materials reflect the studio; the rooms keep their own light.
  const gloss = (m, envMapIntensity) => { if (m?.isMeshPhysicalMaterial && !m.envMap && !m.userData.noEnv) Object.assign(m, { envMap, envMapIntensity, needsUpdate: true }); };
  const lacquer = (root) => root.traverse((o) => { for (const m of [o.material].flat()) gloss(m, 0.4); });
  for (const m of Object.values(pieceMaterials())) gloss(m, 0.85); // pieces are the glossiest thing on the table
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enablePan: false, enableDamping: true, minDistance: 7, maxDistance: 30, maxPolarAngle: 1.38, minPolarAngle: 0.05 });
  controls.addEventListener('start', () => onOrbit?.());

  const hemi = new THREE.HemisphereLight(0xfff1dc, 0x3a2614, 1.1);
  const sun = new THREE.DirectionalLight(0xffe0b0, 2.4);
  sun.position.set(9, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, far: 80 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  const fill = new THREE.DirectionalLight(0xa8c0ff, 0.45);
  fill.position.set(-8, 8, -6);
  // warm key from above: the table and board are the brightest thing in every room, the walls fall off
  const key = new THREE.SpotLight(0xffd49a, 0, 0, 0.34, 1, 0);
  key.position.set(0, 26, 2);
  const label = makeLabel();
  const badge = makeLabel(1.2); // "+3" at the end of the leading side's captured row
  const boardFrame = buildFrame();
  scene.add(hemi, sun, fill, key, key.target, buildTable(), boardFrame, label.mesh, badge.mesh);
  lacquer(scene);

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
    key.color.setHex(room.key[0]);
    key.intensity = room.key[1];
  }

  const { tiles, tileMats, overlays, dots, rings, hover } = buildSquares(scene);
  const clock = createClock();
  clock.group.position.set(6.3, TABLE_Y, 0); // beside the board, between the two seats
  scene.add(clock.group);
  lacquer(scene);
  const setTheme = createThemes({ pieces: pieceMaterials(), glows: glowMaterials(), tiles: tileMats, frame: [boardFrame.material[0], boardFrame.material[2]], coordinates });
  const motion = createMotion();
  const fx = createFx(scene);
  const take = (list, pred, fromEnd = false) => {
    const i = fromEnd ? list.findLastIndex(pred) : list.findIndex(pred);
    return i < 0 ? null : list.splice(i, 1)[0];
  };
  const sink = (g) => motion.move(g, g.position.clone().setY(g.position.y - 0.4), { dur: 0.3, scale: 0.01, onDone: () => scene.remove(g) });

  // ---- pieces: diff the position against what's on screen so moves, captures, castling, undo and resets all animate ----
  let pieces = new Map();
  let grave = []; // captured pieces, in capture order
  let graveCount = { w: 0, b: 0 };
  function syncPieces(chess, last) {
    const want = new Map();
    for (const row of chess.board()) for (const p of row) if (p) want.set(p.square, p.color + p.type);
    const keep = new Map();
    const spare = [];
    for (const [sq, g] of pieces) (want.get(sq) === g.userData.key ? keep.set(sq, g) : spare.push(g));
    let arrive = 0; // when the moving piece lands, so a captured piece gets knocked away on impact
    for (const [sq, key] of want) {
      if (keep.has(sq)) continue;
      const same = (g) => g.userData.key === key;
      let g = take(spare, (x) => same(x) && x.userData.sq === last?.from) ?? take(spare, same) ?? take(grave, same, true);
      if (g?.userData.dropped) { // released by a drag right above its square: just settle
        g.userData.dropped = false;
        arrive = 0.16;
        motion.move(g, at(sq), { dur: 0.16, squash: 0.6 });
      } else if (g) {
        const d = g.position.distanceTo(at(sq));
        const dur = 0.3 + Math.min(0.4, d * 0.05);
        arrive = Math.max(arrive, dur);
        motion.move(g, at(sq), { lift: key[1] === 'n' ? 1 : Math.min(1, 0.25 + d * 0.1), dur });
      } else {
        g = makePiece(key[1], key[0]);
        g.position.copy(sq === last?.to && last.promotion ? at(last.from) : at(sq).add(new THREE.Vector3(0, 2.5, 0)));
        scene.add(g);
        motion.move(g, at(sq), { lift: 0.3 });
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
    const count = (graveCount = { w: 0, b: 0 });
    for (const g of grave) {
      const color = g.userData.key[0];
      const slot = color + count[color];
      const spot = graveSpot(color, count[color]++);
      if (g.userData.slot === slot) continue;
      const captured = g.userData.sq && spare.length === 1; // fresh capture, not a reset shuffle
      if (captured) knockAway(g, arrive * 0.85);
      g.userData.slot = slot;
      g.userData.sq = null;
      motion.move(g, spot, { lift: 1.2, dur: 0.6, delay: captured ? arrive * 0.85 : 0, tumble: captured ? 1 : 0 });
    }
  }
  function knockAway(g, delay) {
    const p = g.position.clone();
    setTimeout(() => { fx.dust(p); motion.nudge(0.04); }, delay * 1000);
  }

  // ---- check glow, and on checkmate: the king topples, the winners hop in a wave, confetti ----
  let glowing = null;
  let toppled = null;
  let lastFen = null;
  function showOutcome(chess, checkSq) {
    const fen = chess.fen();
    const fresh = fen !== lastFen;
    lastFen = fen;
    const king = checkSq ? pieces.get(checkSq) : null;
    if (glowing !== king) { if (glowing) setGlow(glowing, false); if (king) setGlow(king, true); glowing = king; }
    if (toppled && (toppled !== king || !chess.isCheckmate())) { motion.pose(toppled, {}, { dur: 0.4 }); toppled = null; }
    if (!fresh || !king) return;
    if (!chess.isCheckmate()) { motion.nudge(0.03); return; }
    toppled = king;
    motion.pose(king, { rz: Math.random() < 0.5 ? 1.67 : -1.67, y: 0.37 }, { dur: 1.1, delay: 0.5 });
    const winner = chess.turn() === 'w' ? 'b' : 'w';
    setTimeout(() => fx.confetti(winner), 900);
    for (const [sq, g] of pieces) {
      if (g.userData.key[0] === winner) motion.move(g, at(sq), { lift: 0.45, dur: 0.42, delay: 1 + FILES.indexOf(sq[0]) * 0.07 });
    }
  }

  // ---- camera: seated at the player's side, looking down at about 46° ----
  let flipped = null;
  let camTween = null;
  function homeCamera(animate) {
    const { to, target, fov } = fitView(camera, container.clientWidth / Math.max(1, container.clientHeight), flipped);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    controls.maxDistance = Math.max(30, to.distanceTo(target) * 1.3); // narrow windows sit further back
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

  // ---- input: click = press without drag; hover lifts what you can pick; arrow keys + Enter drive a cursor ----
  let ui = { turn: 'w', selected: undefined, targets: new Map(), chess: null };
  const input = createInput({
    container, camera, controls, motion, canvas: renderer.domElement, onSquare, onHome: () => homeCamera(true),
    pieceAt: (sq) => pieces.get(sq),
    pick: () => [...pieces.values(), ...tiles], state: () => ({ ui, flipped }),
    onHover(sq, strong) {
      hover.visible = Boolean(sq);
      for (const m of [hover, ...hover.children]) m.material.opacity = strong ? 0.95 : 0.5; // keyboard cursor is stronger than hover
      if (sq) hover.position.set(at(sq).x, TOP + 0.005, at(sq).z);
    },
  });

  const shake = new THREE.Vector3();
  function frame(now) {
    input.tick();
    motion.tick(now);
    fx.tick(now);
    room?.tick?.(now);
    clock.tick(calm());
    for (const g of pieces.values()) {
      const sq = g.userData.sq;
      const lift = sq === ui.selected ? 0.2 : sq === input.hovered() && input.actionable(sq) ? 0.08 : 0;
      motion.stepPiece(g, lift, onBoardXZ(g.position) ? TOP : TABLE_Y);
    }
    for (const g of grave) motion.stepPiece(g, 0, onBoardXZ(g.position) ? TOP : TABLE_Y);
    const pulse = calm() ? 0.6 : 0.45 + 0.4 * Math.sin(now * 0.006);
    for (const m of Object.values(glowMaterials())) m.emissiveIntensity = pulse;
    if (camTween) {
      const k = Math.min(1, (now - camTween.t0) / 800);
      camera.position.lerpVectors(camTween.from, camTween.to, ease(k));
      controls.target.lerpVectors(camTween.fromT, camTween.target, ease(k));
      if (k === 1) camTween = null;
    }
    controls.update();
    camera.position.add(motion.shakeOffset(now, shake));
    renderer.render(scene, camera);
    camera.position.sub(shake);
    requestAnimationFrame(frame);
  }
  resize();
  requestAnimationFrame(frame);

  return {
    setScene,
    /** 'wood' (default) | 'marble' | 'glass' | 'metal': swaps board and piece materials in place. */
    setTheme,
    /** Chess clock on the table: null hides it, else {w, b, turn, running, flagged} (ms left per side). */
    setClock: (s) => clock.set(s),
    /** Same view object the 2D board uses; `status` is printed on the table. */
    render(chess, view, status) {
      if (flipped !== view.flipped) { const first = flipped === null; flipped = view.flipped; homeCamera(!first); clock.face(flipped); }
      label.set(status, flipped);
      ui = { turn: chess.turn(), selected: view.selected, targets: view.targets, chess };
      let checkSq = null;
      if (chess.inCheck()) for (const row of chess.board()) for (const p of row) if (p?.type === 'k' && p.color === chess.turn()) checkSq = p.square;
      for (const [sq, o] of overlays) {
        const kind = sq === view.selected ? 'sel' : sq === checkSq ? 'check' : view.last && (sq === view.last.from || sq === view.last.to) ? 'last' : null;
        o.visible = Boolean(kind);
        if (kind) { o.material.color.setHex(COLORS[kind]); o.material.opacity = kind === 'last' ? 0.4 : 0.6; }
        dots.get(sq).visible = view.targets.get(sq) === false;
        rings.get(sq).visible = view.targets.get(sq) === true;
      }
      syncPieces(chess, view.last);
      showOutcome(chess, checkSq);
      const bal = materialBalance(chess);
      const row = bal > 0 ? 'b' : 'w'; // white ahead: the row of black pieces white has taken
      const spot = graveSpot(row, graveCount[row]);
      badge.mesh.visible = bal !== 0;
      if (bal) badge.set(`+${Math.abs(bal)}`, flipped, spot.x, spot.z);
      input.refresh();
    },
  };
}

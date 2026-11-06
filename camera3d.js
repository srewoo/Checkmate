// Default camera framing: seated at the player's side, aimed at the board centre at a fixed pitch, as close as
// possible while (a) the board, captured rows, table label and clock stay clear of the HUD, and (b) the far table
// edge sits low enough that the room shows above it.
import * as THREE from './vendor/three.module.min.js';

const PITCH = 0.72; // about 41 degrees above the table
const TABLE = -0.15;
const ROOM_LINE = 0.45; // NDC y the far table edge must stay under: the ~27% of the frame above it shows the room

const vecs = (pts) => pts.map(([x, y, z]) => new THREE.Vector3(x, y, z));
// Portrait drops what the HUD already shows (clock, status label) and the room line, so the board can fill the width.
function mustSee(s, portrait) {
  const pts = [];
  for (const x of [-4.7, 4.7]) for (const z of [-4.7, 4.7]) pts.push([x, 0, z]); // board frame
  for (const x of [-4, 4]) for (const z of [-6.6, 6.6]) pts.push([x, TABLE, z]); // captured rows
  if (portrait) return vecs(pts);
  for (const x of [-2.4, 2.4]) pts.push([x, TABLE, 7.6 * s]); // status label at the player's edge
  pts.push([8.4, 1.1, 0.9], [8.4, 1.1, -0.9], [8.4, TABLE, 0.9], [8.4, TABLE, -0.9]); // chess clock, turned towards the seat
  return vecs(pts);
}
const farEdge = (s) => vecs([[-9.6, TABLE, -9.6 * s], [0, TABLE, -9.6 * s], [9.6, TABLE, -9.6 * s]]);

/** {to, target, fov} for a window of `aspect`, seen from white's side or (flipped) black's. */
export function fitView(camera, aspect, flipped) {
  const s = flipped ? -1 : 1;
  const probe = camera.clone();
  probe.aspect = aspect;
  probe.fov = aspect < 0.9 ? 50 : 40;
  probe.updateProjectionMatrix();
  const [yMin, yMax] = aspect < 0.9 ? [-0.56, 0.66] : [-0.6, 0.8]; // NDC band between the header (~0.74) and the bottom panel (~-0.63)
  const portrait = aspect < 0.9;
  const must = mustSee(s, portrait);
  const far = portrait ? [] : farEdge(s);
  const dir = new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH) * s);
  const target = new THREE.Vector3();
  const v = new THREE.Vector3();
  const place = (d) => { probe.position.copy(target).addScaledVector(dir, d); probe.lookAt(target); probe.updateMatrixWorld(); };
  const fits = () => must.every((p) => { v.copy(p).project(probe); return v.y >= yMin && v.y <= yMax && Math.abs(v.x) <= 0.94; })
    && far.every((p) => v.copy(p).project(probe).y <= ROOM_LINE);
  let near = 6;
  let farD = 90;
  for (let i = 0; i < 24; i++) { const d = (near + farD) / 2; place(d); if (fits()) farD = d; else near = d; }
  place(farD);
  return { to: probe.position.clone(), target, fov: probe.fov };
}

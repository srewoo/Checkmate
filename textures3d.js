// Procedural canvas textures for the 3D rooms. Drawn at load, no image files.
import * as THREE from './vendor/three.module.min.js';

export const rnd = (a, b) => a + Math.random() * (b - a);

/** Canvas -> repeating sRGB texture. `draw(g, size)` paints it. */
export function tex(size, draw, rx = 1, ry = rx) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  return t;
}

function grain(g, s, n, alpha) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * alpha})`;
    g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
  }
}

export function bricks(g, s) {
  g.fillStyle = '#3e3126';
  g.fillRect(0, 0, s, s);
  const h = s / 8;
  const w = s / 4;
  for (let r = 0; r < 8; r++) {
    for (let c = -1; c < 5; c++) {
      g.fillStyle = `hsl(${rnd(22, 36)},${rnd(22, 36)}%,${rnd(30, 44)}%)`;
      g.fillRect(c * w + (r % 2) * (w / 2) + 3, r * h + 3, w - 6, h - 6);
    }
  }
  grain(g, s, 9000, 0.18);
}

export function cobbles(g, s) {
  g.fillStyle = '#26241f';
  g.fillRect(0, 0, s, s);
  const n = 12;
  const cell = s / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const cx = (x + 0.5 + rnd(-0.12, 0.12)) * cell;
      const cy = (y + 0.5 + rnd(-0.12, 0.12)) * cell;
      const r = cell * rnd(0.38, 0.47);
      const l = rnd(30, 48);
      const grd = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
      grd.addColorStop(0, `hsl(38,7%,${l + 14}%)`);
      grd.addColorStop(1, `hsl(38,7%,${l - 12}%)`);
      g.fillStyle = grd;
      g.beginPath();
      g.ellipse(cx, cy, r, r * rnd(0.78, 1), rnd(0, 3), 0, Math.PI * 2);
      g.fill();
    }
  }
  grain(g, s, 12000, 0.2);
}

export function grass(g, s) {
  g.fillStyle = '#4a7d33';
  g.fillRect(0, 0, s, s);
  g.lineWidth = 1.4;
  for (let i = 0; i < 14000; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    g.strokeStyle = `hsl(${rnd(80, 115)},${rnd(35, 55)}%,${rnd(20, 44)}%)`;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + rnd(-2, 2), y - rnd(3, 8));
    g.stroke();
  }
}

export function carpet(g, s) {
  g.fillStyle = '#545a64';
  g.fillRect(0, 0, s, s);
  grain(g, s, 30000, 0.22);
}

export function paint(color) {
  return (g, s) => { g.fillStyle = color; g.fillRect(0, 0, s, s); grain(g, s, 8000, 0.05); };
}

export function deck(g, s) {
  g.fillStyle = '#ebe7dd';
  g.fillRect(0, 0, s, s);
  g.fillStyle = '#b9b2a4';
  for (let i = 0; i < 8; i++) {
    g.fillRect(i * (s / 8), 0, 2, s);
    g.fillRect(0, i * (s / 8), s, 2);
  }
  grain(g, s, 6000, 0.08);
}

export function water(g, s) {
  const grd = g.createLinearGradient(0, 0, s, s);
  grd.addColorStop(0, '#2aa6dc');
  grd.addColorStop(1, '#1580bd');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = `rgba(255,255,255,${rnd(0.08, 0.28)})`;
    g.lineWidth = rnd(1, 3);
    const y0 = Math.random() * s;
    const f = rnd(0.01, 0.03);
    const ph = rnd(0, 6);
    g.beginPath();
    for (let x = 0; x <= s; x += 6) g.lineTo(x, y0 + Math.sin(x * f + ph) * rnd(3, 6));
    g.stroke();
  }
}

export function stripes(a, b, n) {
  return (g, s) => { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect((i * s) / n, 0, s / n, s); } };
}

export function blinds(g, s) {
  const grd = g.createLinearGradient(0, 0, 0, s);
  grd.addColorStop(0, '#bfe2f7');
  grd.addColorStop(1, '#f2f8fb');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  g.fillStyle = 'rgba(120,135,145,0.35)';
  for (let y = 0; y < s; y += 14) g.fillRect(0, y, s, 3);
}

export function books(g, s) {
  g.fillStyle = '#3a2618';
  g.fillRect(0, 0, s, s);
  const shelf = s / 4;
  const hues = [8, 25, 45, 140, 200, 220, 280, 350];
  for (let r = 0; r < 4; r++) {
    let x = 8;
    while (x < s - 8) {
      const w = rnd(10, 24);
      const h = shelf * rnd(0.6, 0.86);
      g.fillStyle = `hsl(${hues[Math.floor(Math.random() * hues.length)]},${rnd(30, 55)}%,${rnd(25, 45)}%)`;
      g.fillRect(x, (r + 1) * shelf - 10 - h, w - 2, h);
      x += w;
    }
    g.fillStyle = '#5a3a22';
    g.fillRect(0, (r + 1) * shelf - 10, s, 10);
  }
}

export function dial(g, s) {
  g.fillStyle = '#f3ecdc';
  g.fillRect(0, 0, s, s);
  g.translate(s / 2, s / 2);
  g.strokeStyle = '#222';
  for (let i = 0; i < 60; i++) {
    g.lineWidth = i % 5 ? 2 : 6;
    g.beginPath();
    g.moveTo(0, -s * 0.44);
    g.lineTo(0, -s * (i % 5 ? 0.4 : 0.36));
    g.stroke();
    g.rotate(Math.PI / 30);
  }
  g.lineCap = 'round';
  g.lineWidth = 10;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(s * 0.18, -s * 0.12); g.stroke();
  g.lineWidth = 6;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(-s * 0.06, -s * 0.34); g.stroke();
  g.fillStyle = '#b3261e';
  g.beginPath(); g.moveTo(s * 0.2, -s * 0.36); g.lineTo(s * 0.26, -s * 0.3); g.lineTo(s * 0.17, -s * 0.28); g.fill();
}

/** Vertical gradient for scene.background. */
export function sky(top, horizon) {
  const t = tex(256, (g, s) => {
    const grd = g.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, top);
    grd.addColorStop(1, horizon);
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

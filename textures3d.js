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

export function stripes(a, b, n) {
  return (g, s) => { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect((i * s) / n, 0, s / n, s); } };
}

/** Veined marble: soft mottling plus a few wandering veins (blurred) and hairline offshoots. */
export function marble(base, vein) {
  return (g, s) => {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 14; i++) {
      const grd = g.createRadialGradient(rnd(0, s), rnd(0, s), 0, rnd(0, s), rnd(0, s), s * rnd(0.2, 0.5));
      grd.addColorStop(0, `rgba(128,128,128,${rnd(0.03, 0.08)})`);
      grd.addColorStop(1, 'rgba(128,128,128,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, s, s);
    }
    g.strokeStyle = vein;
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      let x = rnd(-0.2, 0.6) * s;
      let y = rnd(0, s);
      let a = rnd(-0.6, 0.6);
      g.globalAlpha = rnd(0.25, 0.7);
      g.lineWidth = i < 4 ? rnd(1.5, 4) : rnd(0.5, 1.2);
      g.filter = i < 4 ? 'blur(1.2px)' : 'none';
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 40; k++) { a += rnd(-0.35, 0.35); x += Math.cos(a) * s * 0.03; y += Math.sin(a) * s * 0.03; g.lineTo(x, y); }
      g.stroke();
    }
    g.filter = 'none';
    g.globalAlpha = 1;
  };
}

/** Brushed metal: fine streaks along one axis. */
export function brushed(base) {
  return (g, s) => {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${rnd(0.02, 0.09)})`;
      g.fillRect(0, Math.random() * s, s, rnd(0.5, 1.5));
    }
  };
}

export function slate(base) {
  return (g, s) => {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 30; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${rnd(0.02, 0.05)})`;
      g.fillRect(0, Math.random() * s, s, rnd(2, 10));
    }
    grain(g, s, 6000, 0.12);
  };
}

/** 2x2 twill carbon-fibre weave. */
export function carbon(g, s) {
  const n = 32;
  const c = s / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const along = (x + y) % 4 < 2;
      const grd = along ? g.createLinearGradient(x * c, 0, x * c + c, 0) : g.createLinearGradient(0, y * c, 0, y * c + c);
      grd.addColorStop(0, '#0d0e10');
      grd.addColorStop(0.5, along ? '#34373c' : '#26282c');
      grd.addColorStop(1, '#0d0e10');
      g.fillStyle = grd;
      g.fillRect(x * c, y * c, c, c);
    }
  }
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

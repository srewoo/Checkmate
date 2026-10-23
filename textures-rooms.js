// Procedural canvas drawers for the room surfaces: stone, grass, planks, rug, plaster, tiles, water light, art, books.
// Each is (g, size) => void and tiles seamlessly where it repeats. Use with tex() from textures3d.js.
import { rnd } from './textures3d.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const wrap9 = (s, draw) => { for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) draw(ox, oy); };

function speckle(g, s, n, alpha, size = 2) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * alpha})`;
    g.fillRect(Math.random() * s, Math.random() * s, size, size);
  }
}

function blotches(g, s, n, colors, alpha, rMin, rMax) {
  for (let i = 0; i < n; i++) {
    const x = rnd(0, s);
    const y = rnd(0, s);
    const r = rnd(rMin, rMax) * s;
    wrap9(s, (ox, oy) => {
      const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      grd.addColorStop(0, pick(colors).replace('A', String(alpha * rnd(0.5, 1))));
      grd.addColorStop(1, pick(colors).replace('A', '0'));
      g.fillStyle = grd;
      g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    });
  }
}

/** Irregular flagstones: a jittered lattice (periodic, so it tiles) inset by thin dark mortar, each stone domed. */
export function flagstones(g, s) {
  const n = 9;
  const c = s / n;
  const jit = Array.from({ length: n }, () => Array.from({ length: n }, () => [rnd(-0.32, 0.32) * c, rnd(-0.32, 0.32) * c]));
  const P = (i, j) => [i * c + jit[i % n][j % n][0], j * c + jit[i % n][j % n][1]];
  g.fillStyle = '#3a342d';
  g.fillRect(0, 0, s, s);
  g.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const pts = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)];
      const cx = pts.reduce((a, p) => a + p[0], 0) / 4;
      const cy = pts.reduce((a, p) => a + p[1], 0) / 4;
      const inset = pts.map(([x, y]) => [cx + (x - cx) * 0.9, cy + (y - cy) * 0.9]);
      const l = rnd(44, 60);
      const hue = rnd(26, 40);
      const sat = rnd(6, 16);
      wrap9(s, (ox, oy) => {
        const grd = g.createRadialGradient(cx + ox - c * 0.15, cy + oy - c * 0.2, c * 0.05, cx + ox, cy + oy, c * 0.7);
        grd.addColorStop(0, `hsl(${hue},${sat}%,${l + 8}%)`);
        grd.addColorStop(1, `hsl(${hue},${sat}%,${l - 10}%)`);
        g.fillStyle = grd;
        g.strokeStyle = grd;
        g.lineWidth = c * 0.08;
        g.beginPath();
        inset.forEach(([x, y], k) => (k ? g.lineTo(x + ox, y + oy) : g.moveTo(x + ox, y + oy)));
        g.closePath();
        g.fill();
        g.stroke();
      });
    }
  }
  speckle(g, s, 26000, 0.16);
}

/** Muted, mottled lawn with fine blades and a few bare specks. */
export function lawn(g, s) {
  g.fillStyle = 'hsl(88,28%,31%)';
  g.fillRect(0, 0, s, s);
  blotches(g, s, 40, ['hsla(95,30%,22%,A)', 'hsla(80,30%,40%,A)', 'hsla(60,25%,38%,A)'], 0.35, 0.05, 0.18);
  g.lineWidth = 1.2;
  for (let i = 0; i < 26000; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    g.strokeStyle = `hsl(${rnd(72, 105)},${rnd(22, 38)}%,${rnd(20, 44)}%)`;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + rnd(-1.5, 1.5), y - rnd(2, 6));
    g.stroke();
  }
  speckle(g, s, 900, 0.25, 1.5);
}

export function gravel(g, s) {
  g.fillStyle = '#9a8f7e';
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = `hsl(${rnd(25, 45)},${rnd(5, 15)}%,${rnd(40, 75)}%)`;
    g.beginPath();
    g.ellipse(Math.random() * s, Math.random() * s, rnd(1, 3.5), rnd(1, 2.5), rnd(0, 3), 0, Math.PI * 2);
    g.fill();
  }
  speckle(g, s, 6000, 0.2);
}

/** Oak floor planks in staggered rows, each with its own tone and grain. */
export function planks(g, s) {
  const rows = 8;
  const h = s / rows;
  for (let r = 0; r < rows; r++) {
    let x = rnd(0, s);
    const end = x + s;
    while (x < end) {
      const w = Math.min(end - x, rnd(0.3, 0.7) * s);
      const l = rnd(30, 42);
      for (const ox of [-s, 0]) {
        g.fillStyle = `hsl(${rnd(24, 32)},${rnd(32, 44)}%,${l}%)`;
        g.fillRect(x + ox, r * h, w, h);
        g.strokeStyle = 'rgba(40,20,8,0.25)';
        for (let k = 0; k < 5; k++) {
          const y0 = r * h + rnd(2, h - 2);
          g.lineWidth = rnd(0.5, 1.5);
          g.beginPath();
          for (let t = 0; t <= w; t += 8) g.lineTo(x + ox + t, y0 + Math.sin(t * 0.02 + k) * 2);
          g.stroke();
        }
        g.fillStyle = 'rgba(25,12,4,0.7)';
        g.fillRect(x + ox, r * h, 2, h);
      }
      x += w;
    }
    g.fillStyle = 'rgba(25,12,4,0.75)';
    g.fillRect(0, r * h, s, 2);
  }
  speckle(g, s, 5000, 0.06);
}

/** Wool rug: navy border with a gold line and diamonds, a muted red field and a centre medallion. */
export function rug(g, s) {
  g.fillStyle = '#6b3830';
  g.fillRect(0, 0, s, s);
  const band = s * 0.09;
  g.fillStyle = '#2d3447';
  g.fillRect(0, 0, s, s);
  g.fillStyle = '#6b3830';
  g.fillRect(band, band, s - 2 * band, s - 2 * band);
  g.strokeStyle = '#b48c4e';
  g.lineWidth = 4;
  g.strokeRect(band * 0.25, band * 0.25, s - band * 0.5, s - band * 0.5);
  g.strokeRect(band + 6, band + 6, s - 2 * band - 12, s - 2 * band - 12);
  g.fillStyle = '#b48c4e';
  for (let t = band; t < s - band; t += band * 0.6) {
    for (const [x, y] of [[t, band / 2], [t, s - band / 2], [band / 2, t], [s - band / 2, t]]) {
      g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 8, y); g.lineTo(x, y + 8); g.lineTo(x - 8, y); g.fill();
    }
  }
  for (const [r, color] of [[0.3, '#2d3447'], [0.22, '#8a4a3a'], [0.12, '#b48c4e'], [0.05, '#2d3447']]) {
    g.fillStyle = color;
    g.beginPath(); g.moveTo(s / 2, s / 2 - r * s); g.lineTo(s / 2 + r * s, s / 2); g.lineTo(s / 2, s / 2 + r * s); g.lineTo(s / 2 - r * s, s / 2); g.fill();
  }
  speckle(g, s, 30000, 0.12, 1.5);
}

export function plaster(color) {
  return (g, s) => {
    g.fillStyle = color;
    g.fillRect(0, 0, s, s);
    blotches(g, s, 30, ['rgba(255,255,255,A)', 'rgba(90,80,70,A)'], 0.06, 0.08, 0.25);
    speckle(g, s, 9000, 0.05);
  };
}

/** Off-white pool deck tiles with soft grout. */
export function deckTiles(g, s) {
  const n = 8;
  const c = s / n;
  g.fillStyle = '#c4bdb0';
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      g.fillStyle = `hsl(${rnd(36, 44)},${rnd(10, 18)}%,${rnd(86, 92)}%)`;
      g.fillRect(i * c + 2, j * c + 2, c - 4, c - 4);
    }
  }
  speckle(g, s, 7000, 0.07);
}

/** Bright caustic web on black, for an animated emissive map on the water. */
export function caustics(g, s) {
  g.fillStyle = '#000';
  g.fillRect(0, 0, s, s);
  g.filter = 'blur(1.5px)';
  g.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    const x = rnd(0, s);
    const y = rnd(0, s);
    const r = rnd(10, 28);
    const a0 = rnd(0, 6.3);
    g.strokeStyle = `rgba(255,255,255,${rnd(0.25, 0.7)})`;
    g.lineWidth = rnd(1.5, 3.5);
    wrap9(s, (ox, oy) => { g.beginPath(); g.arc(x + ox, y + oy, r, a0, a0 + rnd(1, 2.4)); g.stroke(); });
  }
  g.filter = 'none';
}

/** Pool water: teal with dark lane lines on the floor of the pool. */
export function poolWater(g, s) {
  const grd = g.createLinearGradient(0, 0, s, s);
  grd.addColorStop(0, '#47b9d2');
  grd.addColorStop(1, '#2596bf');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  g.fillStyle = 'rgba(10,40,80,0.35)';
  g.fillRect(s * 0.47, 0, s * 0.06, s);
}

/** A quiet abstract print. */
export function art(g, s) {
  g.fillStyle = '#ece5d6';
  g.fillRect(0, 0, s, s);
  for (const [color, x, y, r] of [['#c98a4b', 0.38, 0.42, 0.24], ['#56708a', 0.62, 0.58, 0.2], ['#b5543c', 0.45, 0.7, 0.1]]) {
    g.globalAlpha = 0.85;
    g.fillStyle = color;
    g.beginPath(); g.arc(x * s, y * s, r * s, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  g.strokeStyle = '#2b2622';
  g.lineWidth = s * 0.008;
  g.beginPath(); g.moveTo(s * 0.15, s * 0.8); g.bezierCurveTo(s * 0.4, s * 0.2, s * 0.6, s * 0.9, s * 0.85, s * 0.25); g.stroke();
  speckle(g, s, 3000, 0.05);
}

const BOOK_HUES = [8, 22, 32, 42, 140, 190, 210, 28, 350];
function book(g, x, base, w, h, lean = 0) {
  g.save();
  g.translate(x, base);
  g.rotate(lean);
  g.fillStyle = `hsl(${pick(BOOK_HUES)},${rnd(15, 32)}%,${rnd(22, 44)}%)`;
  g.fillRect(0, -h, w, h);
  g.fillStyle = 'rgba(255,240,210,0.25)';
  g.fillRect(0, -h + h * 0.08, w, 2);
  g.fillRect(w * 0.25, -h * 0.55, w * 0.5, h * 0.18);
  g.restore();
}

/** Shelves of books: varied sizes, a lean before each gap, flat stacks and the odd ornament. */
export function shelves(g, s) {
  g.fillStyle = '#2a1c12';
  g.fillRect(0, 0, s, s);
  const shelf = s / 4;
  for (let r = 0; r < 4; r++) {
    const base = (r + 1) * shelf - 10;
    let x = 10;
    while (x < s - 30) {
      const roll = Math.random();
      if (roll < 0.08) { x += rnd(20, 40); book(g, x, base, rnd(10, 16), shelf * rnd(0.6, 0.8), -0.25); x += 30; continue; }
      if (roll < 0.16) { for (let k = 0, y = base; k < 4; k++) { const bw = rnd(50, 70); book(g, x, y, bw, rnd(8, 12)); y -= 12; } x += 76; continue; }
      if (roll < 0.21) {
        g.fillStyle = pick(['#c9c2b3', '#5b6e73', '#a0663e']);
        g.beginPath(); g.ellipse(x + 16, base - 22, 14, 22, 0, 0, Math.PI * 2); g.fill();
        x += 40;
        continue;
      }
      const w = rnd(9, 22);
      book(g, x, base, w - 2, shelf * rnd(0.55, 0.86));
      x += w;
    }
    g.fillStyle = '#4a3020';
    g.fillRect(0, base, s, 10);
  }
}

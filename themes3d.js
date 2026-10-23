// Board and piece themes. A theme rewrites the existing materials in place, so pieces on the board, captured
// pieces and running animations keep their meshes. 'wood' is a snapshot of the materials as first built.
// Glass is faked with transparency + clearcoat: real transmission costs an extra full scene pass per frame.
import * as T from './textures3d.js';

const KEYS = ['map', 'roughness', 'metalness', 'clearcoat', 'clearcoatRoughness', 'envMapIntensity', 'transparent', 'opacity'];
const BASE = { map: null, roughness: 0.5, metalness: 0, clearcoat: 0, clearcoatRoughness: 0, envMapIntensity: 0.4, transparent: false, opacity: 1 };
const solid = (color) => (g, s) => { g.fillStyle = color; g.fillRect(0, 0, s, s); };
const polish = { clearcoat: 1, clearcoatRoughness: 0.05 };

const THEMES = {
  marble: {
    w: { draw: T.marble('#ebe7e0', '#7a756f'), roughness: 0.18, envMapIntensity: 0.8, ...polish },
    b: { draw: T.marble('#1c1c1f', '#b9b3a9'), roughness: 0.15, envMapIntensity: 0.9, ...polish },
    light: { draw: T.marble('#ece8e1', '#9b958c'), roughness: 0.22, envMapIntensity: 0.5, ...polish },
    dark: { draw: T.marble('#28372f', '#a9b8ad'), roughness: 0.2, envMapIntensity: 0.5, ...polish },
    frame: { draw: T.marble('#1d1f22', '#6f6b66'), roughness: 0.25, envMapIntensity: 0.5, ...polish },
  },
  glass: {
    w: { color: 0xeef5fa, roughness: 0.3, transparent: true, opacity: 0.72, envMapIntensity: 1.3, ...polish },
    b: { color: 0x2b3138, roughness: 0.06, transparent: true, opacity: 0.84, envMapIntensity: 1.3, ...polish },
    light: { color: 0xa3afb8, roughness: 0.3, envMapIntensity: 0.6, ...polish },
    dark: { color: 0x0e1115, roughness: 0.04, envMapIntensity: 0.8, ...polish },
    frame: { draw: solid('#0b0d10'), roughness: 0.08, envMapIntensity: 0.6, ...polish },
  },
  metal: {
    w: { draw: T.brushed('#c9ced3'), metalness: 1, roughness: 0.32, envMapIntensity: 1 },
    b: { draw: T.brushed('#4a4e55'), metalness: 1, roughness: 0.28, envMapIntensity: 1 },
    light: { draw: T.brushed('#b9bec4'), metalness: 0.85, roughness: 0.38, envMapIntensity: 0.8 },
    dark: { draw: T.slate('#2c3135'), roughness: 0.75, envMapIntensity: 0.3 },
    frame: { draw: T.carbon, size: 512, roughness: 0.35, envMapIntensity: 0.6, clearcoat: 1, clearcoatRoughness: 0.1 },
  },
};

const snapshot = (m) => ({ color: m.color.getHex(), ...Object.fromEntries(KEYS.map((k) => [k, m[k]])) });

function apply(m, props) {
  m.color.set(props.color ?? 0xffffff);
  for (const k of KEYS) m[k] = props[k] ?? BASE[k];
  m.needsUpdate = true; // map/transparency changes need a new shader
}

/**
 * `pieces`/`glows`: {w, b} materials; `tiles`: [light, dark, light, dark, ...] variants; `frame`: [edge, face].
 * `coordinates(g, size)` prints the file/rank letters on the frame face texture. Returns setTheme(name).
 */
export function createThemes({ pieces, glows, tiles, frame, coordinates }) {
  const roles = [
    ...['w', 'b'].map((c) => ({ m: pieces[c], role: c })),
    ...tiles.map((m, i) => ({ m, role: i % 2 ? 'dark' : 'light' })),
    { m: frame[0], role: 'frame' },
    { m: frame[1], role: 'frame', coords: true },
  ].map((r) => ({ ...r, wood: snapshot(r.m) }));
  const cache = new Map();
  function texture(name, spec, r) {
    if (!spec.draw) return null;
    const key = `${name}:${r.role}:${r.coords ? 'face' : ''}`;
    if (!cache.has(key)) cache.set(key, T.tex(r.coords ? 1024 : spec.size ?? 512, (g, s) => { spec.draw(g, s); if (r.coords) coordinates(g, s); }));
    const t = cache.get(key).clone(); // each tile variant keeps the grain rotation it had in wood
    if (r.wood.map) { t.rotation = r.wood.map.rotation; t.offset.copy(r.wood.map.offset); }
    return t;
  }
  let current = 'wood';
  return (name) => {
    const theme = THEMES[name];
    if ((theme ? name : 'wood') === current) return;
    current = theme ? name : 'wood';
    for (const r of roles) {
      if (r.m.map && r.m.map !== r.wood.map) r.m.map.dispose(); // per-variant clone from the previous theme
      apply(r.m, theme ? { ...theme[r.role], map: texture(name, theme[r.role], r) } : r.wood);
    }
    for (const c of ['w', 'b']) {
      const { emissive, emissiveIntensity } = glows[c];
      glows[c].copy(pieces[c]);
      Object.assign(glows[c], { emissiveIntensity }).emissive.copy(emissive);
    }
  };
}

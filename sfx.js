// Move sounds synthesised with Web Audio (wood knock, capture clack, check ping, end chord, low-time tick). No files.
let ctx;

/** Short band-passed noise burst: the knock of a wooden piece on a wooden board. */
function knock(t, freq, gain, len = 0.07) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
  const src = Object.assign(ctx.createBufferSource(), { buffer: buf });
  const f = Object.assign(ctx.createBiquadFilter(), { type: 'bandpass' });
  f.frequency.value = freq;
  f.Q.value = 1.6;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t);
}

function tone(t, freq, gain, len) {
  const o = Object.assign(ctx.createOscillator(), { type: 'sine' });
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + len + 0.05);
}

const SOUNDS = {
  move: (t) => knock(t, 900, 0.9),
  capture: (t) => { knock(t, 1300, 1.1); knock(t + 0.045, 700, 0.8); },
  castle: (t) => { knock(t, 900, 0.8); knock(t + 0.11, 1000, 0.8); },
  promote: (t) => { knock(t, 900, 0.8); tone(t + 0.05, 880, 0.12, 0.25); tone(t + 0.12, 1320, 0.1, 0.3); },
  check: (t) => { knock(t, 900, 0.8); tone(t + 0.02, 1046, 0.14, 0.35); },
  end: (t) => [523, 659, 784].forEach((f, i) => tone(t + i * 0.09, f, 0.12, 0.9)),
  low: (t) => { tone(t, 1760, 0.08, 0.08); tone(t + 0.16, 1760, 0.08, 0.08); },
};

/** Must first be called after a user gesture (autoplay policy); before that it's silent. */
export function playSfx(kind) {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    SOUNDS[kind]?.(ctx.currentTime + 0.01);
  } catch (err) { console.warn('[checkmate] sound failed:', err); }
}

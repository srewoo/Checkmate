// Subtle per-scene background sound, synthesised with Web Audio: no audio files, nothing to license.
const VOLUME = 0.22;
let ctx;
let master;
let live = []; // sources + timers of the running scene

const rand = (a, b) => a + Math.random() * (b - a);

function noiseBuffer(kind) {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    d[i] = kind === 'brown' ? (last = (last + 0.02 * w) / 1.02) * 3.5 : w;
  }
  return buf;
}

/** Looping noise -> filter -> gain -> master. Returns the gain so callers can modulate it. */
function bed(kind, type, freq, gain, q = 0.7) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(kind);
  src.loop = true;
  const f = Object.assign(ctx.createBiquadFilter(), { type });
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(master);
  src.start();
  live.push(src);
  return { g, f };
}

/** Slow wobble on an AudioParam (wind gusts, water swell). */
function wobble(param, rate, depth) {
  const o = ctx.createOscillator();
  o.frequency.value = rate;
  const d = ctx.createGain();
  d.gain.value = depth;
  o.connect(d).connect(param);
  o.start();
  live.push(o);
}

function every(minS, maxS, fn) {
  const timer = { id: 0 };
  const tick = () => { fn(ctx.currentTime); timer.id = setTimeout(tick, rand(minS, maxS) * 1000); };
  timer.id = setTimeout(tick, rand(minS, maxS) * 1000);
  live.push(timer);
}

function chirp(t, base) {
  for (let i = 0, n = Math.ceil(rand(2, 5)); i < n; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const s = t + i * rand(0.09, 0.16);
    o.frequency.setValueAtTime(base, s);
    o.frequency.exponentialRampToValueAtTime(base * rand(1.3, 1.7), s + 0.07);
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.05, s + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.08);
    o.connect(g).connect(master);
    o.start(s);
    o.stop(s + 0.1);
  }
}

function burst(t, freq, dur, level) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer('white');
  const f = Object.assign(ctx.createBiquadFilter(), { type: 'bandpass' });
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
}

const SCENES = {
  indoor() { // quiet courtyard: room tone, a distant sparrow now and then
    bed('brown', 'lowpass', 380, 0.5);
    every(7, 16, (t) => chirp(t, rand(2800, 3600)));
  },
  park() { // wind through trees, rustling leaves, birds
    const wind = bed('brown', 'bandpass', 500, 0.45);
    wobble(wind.g.gain, 0.08, 0.25);
    wobble(wind.f.frequency, 0.05, 180);
    const leaves = bed('white', 'highpass', 3500, 0.015);
    wobble(leaves.g.gain, 0.2, 0.012);
    every(2, 6, (t) => chirp(t, rand(2600, 4200)));
  },
  office() { // air conditioning and the odd burst of typing
    bed('brown', 'lowpass', 220, 0.6);
    bed('white', 'bandpass', 900, 0.008, 0.4);
    every(5, 12, (t) => {
      for (let i = 0, n = Math.ceil(rand(4, 12)); i < n; i++) burst(t + i * rand(0.08, 0.18), rand(2500, 4000), 0.03, 0.12);
    });
  },
  pool() { // water lapping, filter pump, occasional splash
    const water = bed('brown', 'bandpass', 380, 0.7, 1.2);
    wobble(water.g.gain, 0.17, 0.35);
    wobble(water.f.frequency, 0.11, 140);
    bed('white', 'highpass', 6000, 0.006);
    every(8, 20, (t) => burst(t, rand(900, 1600), rand(0.4, 0.8), 0.25));
  },
};

function stop() {
  for (const x of live) if ('id' in x) clearTimeout(x.id); else x.stop();
  live = [];
  master?.disconnect();
}

/** Needs a prior user gesture (browser autoplay policy). Safe to call repeatedly. */
export function setAmbient(scene, on) {
  stop();
  if (!on || !SCENES[scene]) return;
  ctx ??= new AudioContext();
  ctx.resume();
  master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(VOLUME, ctx.currentTime + 2);
  master.connect(ctx.destination);
  SCENES[scene]();
}

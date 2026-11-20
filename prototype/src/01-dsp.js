/* ===== Forge DSP: helpers + drum synthesis (pre-rendered to buffers) ===== */
'use strict';
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const midiName = m => NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const dbToGain = db => (db <= -60 ? 0 : Math.pow(10, db / 20));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const SCALES = {
  minor: [0,2,3,5,7,8,10], major: [0,2,4,5,7,9,11], dorian: [0,2,3,5,7,9,10],
  harmonic: [0,2,3,5,7,8,11], phrygian: [0,1,3,5,7,8,10], pentatonic: [0,3,5,7,10]
};
const SCALE_LABELS = { minor:'Minor', major:'Major', dorian:'Dorian', harmonic:'Harm. minor', phrygian:'Phrygian', pentatonic:'Minor pent.' };

function makeNoise(ctx, secs, seed) {
  const n = Math.floor(ctx.sampleRate * secs);
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  let s = (seed || 1) >>> 0;
  for (let i = 0; i < n; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1; }
  return b;
}
function satCurve(k) {
  const n = 2048, a = new Float32Array(n), tk = Math.tanh(k);
  for (let i = 0; i < n; i++) { const x = (i * 2) / (n - 1) - 1; a[i] = Math.tanh(k * x) / tk; }
  return a;
}
function makeIR(ctx, secs = 2.4, decay = 3.0, chans = 2) {
  const sr = ctx.sampleRate, n = Math.floor(sr * secs), b = ctx.createBuffer(chans, n, sr);
  const pre = Math.floor(sr * 0.012);
  for (let ch = 0; ch < chans; ch++) {
    const d = b.getChannelData(ch); let s = 4242 + ch * 977, y = 0;
    for (let i = pre; i < n; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const x = (s / 4294967296) * 2 - 1, u = (i - pre) / (n - pre);
      y += (x - y) * (0.85 - 0.75 * u);                 // gets darker as it decays
      d[i] = y * Math.pow(1 - u, decay) * (u < 0.01 ? u * 100 : 1);
    }
  }
  return b;
}
function normalize(buf, target) {
  let pk = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; } }
  const g = pk > 0 ? target / pk : 1;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= g; }
  return buf;
}
const noiseSrc = (c, seed, secs) => { const s = c.createBufferSource(); s.buffer = makeNoise(c, secs, seed); return s; };
const filt = (c, type, f, q) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; };
// generic envelope: attack to peak, exponential decay toward sustain, release at end
function adsr(p, t, pk, att, dec, sus, end, rel) {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(pk, t + att);
  p.setTargetAtTime(pk * sus, t + att, dec);
  p.setTargetAtTime(0, Math.max(end, t + att + 0.005), rel);
}

/* Each drum builds into an OfflineAudioContext, then becomes an AudioBuffer (round-robin variants differ by noise seed). */
const DRUMS = {
  kick: { dur: 1.0, rr: 1, build(c, out) {
    const t = 0.003, o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(215, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.07);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.6);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.85);
    const sh = c.createWaveShaper(); sh.curve = satCurve(2.4);
    o.connect(g); g.connect(sh); sh.connect(out); o.start(t); o.stop(t + 0.95);
    const n = noiseSrc(c, 11, 0.05), hp = filt(c, 'highpass', 1800), ng = c.createGain();
    ng.gain.setValueAtTime(0.45, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
    n.connect(hp); hp.connect(ng); ng.connect(out); n.start(t);
  } },
  snare: { dur: 0.6, rr: 3, build(c, out, seed) {
    const t = 0.003, o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(335, t); o.frequency.exponentialRampToValueAtTime(178, t + 0.05);
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.75, t + 0.002); og.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
    o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.3);
    const n = noiseSrc(c, seed * 13 + 5, 0.5), hp = filt(c, 'highpass', 1400), bp = filt(c, 'bandpass', 3900, 0.55), ng = c.createGain();
    ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(1, t + 0.001); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.19 + seed * 0.012);
    n.connect(hp); hp.connect(bp); bp.connect(ng); ng.connect(out); n.start(t);
  } },
  clap: { dur: 0.55, rr: 3, build(c, out, seed) {
    const t = 0.003, n = noiseSrc(c, seed * 7 + 3, 0.6), hp = filt(c, 'highpass', 700), bp = filt(c, 'bandpass', 1250 + seed * 60, 1.1), g = c.createGain();
    [0, 0.0105, 0.0225].forEach((d, i) => {
      g.gain.setValueAtTime(0.0001, t + d); g.gain.linearRampToValueAtTime(0.9 - i * 0.05, t + d + 0.001); g.gain.exponentialRampToValueAtTime(0.12, t + d + 0.0085);
    });
    g.gain.setValueAtTime(0.0001, t + 0.0355); g.gain.linearRampToValueAtTime(1, t + 0.0365); g.gain.exponentialRampToValueAtTime(0.001, t + 0.0365 + 0.2);
    n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(out); n.start(t);
  } },
  hat: { dur: 0.25, rr: 3, build(c, out, seed) {
    const t = 0.002, n = noiseSrc(c, seed * 17 + 1, 0.3), hp = filt(c, 'highpass', 7200, 0.5), pk = filt(c, 'peaking', 10500, 1);
    pk.gain.value = 5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 0.001); g.gain.exponentialRampToValueAtTime(0.28, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.085 + seed * 0.008);
    n.connect(hp);
    [7050, 9320, 11800].forEach(f => { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f * (1 + seed * 0.004); const og = c.createGain(); og.gain.value = 0.1; o.connect(og); og.connect(hp); o.start(t); o.stop(t + 0.2); });
    hp.connect(pk); pk.connect(g); g.connect(out); n.start(t);
  } },
  ohat: { dur: 0.9, rr: 2, build(c, out, seed) {
    const t = 0.002, n = noiseSrc(c, seed * 19 + 2, 0.8), hp = filt(c, 'highpass', 6500, 0.5), pk = filt(c, 'peaking', 9500, 1);
    pk.gain.value = 4;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 0.002); g.gain.exponentialRampToValueAtTime(0.35, t + 0.12); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5 + seed * 0.03);
    n.connect(hp);
    [7050, 9320, 11800].forEach(f => { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f; const og = c.createGain(); og.gain.value = 0.08; o.connect(og); og.connect(hp); o.start(t); o.stop(t + 0.7); });
    hp.connect(pk); pk.connect(g); g.connect(out); n.start(t);
  } },
  rim: { dur: 0.3, rr: 3, build(c, out, seed) {
    const t = 0.002;
    [[1700 + seed * 25, 0.5, 0.03], [2550, 0.25, 0.022]].forEach(([f, a, d]) => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + 0.001); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.1);
    });
    const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 480; const g2 = c.createGain();
    g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.5, t + 0.001); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o2.connect(g2); g2.connect(out); o2.start(t); o2.stop(t + 0.12);
    const n = noiseSrc(c, seed * 5 + 9, 0.05), hp = filt(c, 'highpass', 3200), ng = c.createGain();
    ng.gain.setValueAtTime(0.5, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
    n.connect(hp); hp.connect(ng); ng.connect(out); n.start(t);
  } }
};

async function prerenderDrums() {
  const SR = 48000, bufs = {}, jobs = [];
  for (const [name, def] of Object.entries(DRUMS)) {
    bufs[name] = [];
    for (let v = 0; v < def.rr; v++) {
      jobs.push((async () => {
        const oc = new OfflineAudioContext(1, Math.ceil(SR * def.dur), SR);
        def.build(oc, oc.destination, v + 1);
        const b = await oc.startRendering();
        bufs[name][v] = normalize(b, name === 'kick' ? 0.95 : 0.9);
      })());
    }
  }
  await Promise.all(jobs);
  return bufs;
}

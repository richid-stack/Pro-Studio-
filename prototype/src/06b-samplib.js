/* ===== Sampler library: storage, decoding, onset / pitch / loop analysis ===== */
const SLIB = { clips: [], db: null, ready: false, drums: {}, origDrums: {} };

/* ---- IndexedDB (per viewer; the page works without it) ---- */
function idbOpen() {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open('forge-lib', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('clips', { keyPath: 'id' }); r.result.createObjectStore('meta', { keyPath: 'k' }); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
}
function idbRun(store, mode, fn) {
  return new Promise((res, rej) => {
    if (!SLIB.db) return rej(new Error('no db'));
    const tx = SLIB.db.transaction(store, mode), st = tx.objectStore(store), rq = fn(st);
    tx.oncomplete = () => res(rq && rq.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
  });
}
const idbAll = store => idbRun(store, 'readonly', s => s.getAll());
const idbPut = (store, obj) => idbRun(store, 'readwrite', s => s.put(obj)).catch(() => {});
const idbDel = (store, key) => idbRun(store, 'readwrite', s => s.delete(key)).catch(() => {});

async function decodeBytes(bytes) {
  const oc = new OfflineAudioContext(2, 1, 44100);
  const b = await oc.decodeAudioData(bytes.slice(0));            // decode works without a user gesture
  return normalize(b, 0.9);
}
function monoOf(buf) {
  const n = buf.length, out = new Float32Array(n), ch = buf.numberOfChannels;
  for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) out[i] += d[i] / ch; }
  return out;
}
function reversedCopy(buf) {
  const r = new AudioBuffer({ length: buf.length, numberOfChannels: buf.numberOfChannels, sampleRate: buf.sampleRate });
  for (let c = 0; c < buf.numberOfChannels; c++) { const s = buf.getChannelData(c), d = r.getChannelData(c), n = s.length; for (let i = 0; i < n; i++) d[i] = s[n - 1 - i]; }
  return r;
}
function sliceCopy(buf, a, b) {                                    // seconds -> new AudioBuffer
  const sr = buf.sampleRate, i0 = Math.max(0, Math.floor(a * sr)), i1 = Math.min(buf.length, Math.max(i0 + 64, Math.floor(b * sr)));
  const r = new AudioBuffer({ length: i1 - i0, numberOfChannels: buf.numberOfChannels, sampleRate: sr });
  for (let c = 0; c < buf.numberOfChannels; c++) r.getChannelData(c).set(buf.getChannelData(c).subarray(i0, i1));
  return r;
}

/* ---- onset detection: two bands (raw = kicks and bass, differenced = snares and hats), positive flux of log energy, adaptive threshold ---- */
function detectOnsets(buf, sens, maxN) {
  const x = monoOf(buf), sr = buf.sampleRate, N = 1024, H = 256, F = Math.max(0, Math.floor((x.length - N) / H));
  if (F < 8) return [0];
  const eR = new Float32Array(F), eD = new Float32Array(F); let mR = 0, mD = 0;
  for (let f = 0; f < F; f++) {
    const o = f * H; let r = 0, d = 0;
    for (let i = 0; i < N; i++) { const v = x[o + i], u = v - (o + i > 0 ? x[o + i - 1] : 0); r += v * v; d += u * u; }
    eR[f] = r / N; eD[f] = d / N; if (eR[f] > mR) mR = eR[f]; if (eD[f] > mD) mD = eD[f];
  }
  const fR = Math.max(1e-9, mR * 1e-4), fD = Math.max(1e-9, mD * 1e-4);      // ignore wobble more than 40 dB under the loudest part (fading 808 tails, hiss)
  const fl = new Float32Array(F);
  for (let f = 1; f < F; f++) fl[f] = Math.max(0, Math.log(fR + eR[f]) - Math.log(fR + eR[f - 1]), Math.log(fD + eD[f]) - Math.log(fD + eD[f - 1]));
  const pre = new Float64Array(F + 1), pre2 = new Float64Array(F + 1);
  for (let f = 0; f < F; f++) { pre[f + 1] = pre[f] + fl[f]; pre2[f + 1] = pre2[f] + fl[f] * fl[f]; }
  const k = 2.6 - 2.2 * sens, absT = 1.4 - 1.1 * sens, W = 24, minD = Math.ceil((0.06 * sr) / H), picks = [];
  for (let f = 2; f < F - 1; f++) {
    const a = Math.max(0, f - W), b = Math.min(F, f + W), n = b - a, mean = (pre[b] - pre[a]) / n, sd = Math.sqrt(Math.max(0, (pre2[b] - pre2[a]) / n - mean * mean));
    if (fl[f] > mean + k * sd && fl[f] > absT && fl[f] >= fl[f - 1] && fl[f] >= fl[f + 1]) {
      const last = picks[picks.length - 1];
      if (last && f - last.f < minD) { if (fl[f] > last.s) { last.f = f; last.s = fl[f]; } } else picks.push({ f, s: fl[f] });
    }
  }
  let keep = picks; if (keep.length > maxN) keep = keep.slice().sort((p, q) => q.s - p.s).slice(0, maxN).sort((p, q) => p.f - q.f);
  const times = keep.map(p => {                                    // the hit entered the window somewhere in its last hop; find where the transient really starts, then back off 2 ms to a rising zero crossing
    const end = Math.min(x.length - 1, p.f * H + N), lo = Math.max(1, end - H - Math.floor(0.012 * sr));
    let pk = 0; for (let i = lo; i <= end; i++) { const v = Math.abs(x[i]); if (v > pk) pk = v; }
    let st = lo; for (let i = lo; i <= end; i++) if (Math.abs(x[i]) > 0.1 * pk) { st = i; break; }
    let z = Math.max(1, st - Math.floor(0.002 * sr)); for (let i = z; i > Math.max(1, z - Math.floor(0.004 * sr)); i--) if (x[i - 1] <= 0 && x[i] > 0) { z = i; break; }
    return z / sr;
  });
  let rms = 0; for (let i = 0; i < N; i++) rms += x[i] * x[i];
  if (Math.sqrt(rms / N) > 0.05 && (!times.length || times[0] > 0.05)) times.unshift(0);   // the file starts on a hit
  if (!times.length) times.push(0);
  return times.slice(0, maxN);
}
const evenSlices = (dur, n) => Array.from({ length: n }, (_, i) => (dur * i) / n);

/* ---- pitch detection (YIN) on the loudest stretch of the clip ---- */
function detectPitch(buf) {
  const x = monoOf(buf), sr = buf.sampleRate, W = 4096, half = W / 2;
  if (x.length < W) return null;
  let best = 0, bi = 0;
  const lim = Math.min(x.length - W, Math.floor(sr * 3));
  for (let s = 0; s <= lim; s += 1024) { let e = 0; for (let i = 0; i < W; i += 4) e += x[s + i] * x[s + i]; if (e > best) { best = e; bi = s; } }
  if (best < 1e-4) return null;
  const tMin = Math.max(2, Math.floor(sr / 2000)), tMax = Math.min(half - 1, Math.floor(sr / 28)), d = new Float32Array(tMax + 2), cm = new Float32Array(tMax + 2);
  for (let tau = 1; tau <= tMax; tau++) { let s = 0; for (let i = 0; i < half; i++) { const v = x[bi + i] - x[bi + i + tau]; s += v * v; } d[tau] = s; }
  let run = 0; cm[0] = 1; for (let tau = 1; tau <= tMax; tau++) { run += d[tau]; cm[tau] = run ? (d[tau] * tau) / run : 1; }
  let tau = -1;
  for (let t = tMin; t < tMax; t++) { if (cm[t] < 0.15) { while (t + 1 < tMax && cm[t + 1] < cm[t]) t++; tau = t; break; } }
  if (tau < 0) { let m = 9; for (let t = tMin; t < tMax; t++) if (cm[t] < m) { m = cm[t]; tau = t; } if (m > 0.4) return null; }
  const a = cm[tau - 1], b = cm[tau], c = cm[tau + 1], den = a - 2 * b + c, off = den ? (0.5 * (a - c)) / den : 0, f = sr / (tau + off);
  return { midi: 69 + 12 * Math.log2(f / 440), conf: 1 - cm[tau] };
}

/* ---- loop finder: end point whose waveform best matches the loop start ---- */
function findLoop(buf) {
  const x = monoOf(buf), sr = buf.sampleRate, n = x.length, dur = n / sr; if (dur < 0.3) return null;
  let ls = Math.floor(n * 0.35); while (ls < n - 2 && !(x[ls - 1] <= 0 && x[ls] > 0)) ls++;
  const win = Math.floor(0.012 * sr); let best = 1e18, le = -1;
  for (let e = Math.floor(n * 0.75); e < Math.floor(n * 0.97) - win; e++) {
    if (!(x[e - 1] <= 0 && x[e] > 0)) continue;
    let s = 0; for (let i = 0; i < win; i++) { const v = x[ls + i] - x[e + i]; s += v * v; }
    if (s < best) { best = s; le = e; }
  }
  return le > ls ? { ls: ls / sr, le: le / sr } : null;
}

/* ---- persistence ---- */
async function libInit() {
  try { SLIB.db = await idbOpen(); } catch (e) { SLIB.db = null; }
  SLIB.ready = true;
}
const saveClip = c => idbPut('clips', { id: c.id, name: c.name, bytes: c.bytes, slices: c.slices });
function saveLibState() {
  const z = LIB.inst.zones.map(q => ({ clipId: q.clipId, a: q.a, b: q.b, root: q.root, lo: q.lo, hi: q.hi, loop: q.loop, ls: q.ls, le: q.le, gain: q.gain, name: q.name }));
  idbPut('meta', { k: 'state', clip: typeof S !== 'undefined' && S.clip ? S.clip.id : null, pitch: LIB.chop ? LIB.chop.pitch : 0, reverse: LIB.chop ? LIB.chop.reverse : false, gate: LIB.chop ? LIB.chop.gate : false,
    attack: LIB.inst.attack, release: LIB.inst.release, zones: z, drums: SLIB.drums });
}

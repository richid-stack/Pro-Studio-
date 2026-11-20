/* ===== Forge engine: mixer graph, instruments, sequencer ===== */
// Shared sampler state, written by the sampler UI and read by the voices below.
const LIB = { chop: null, inst: { zones: [], attack: 0.005, release: 0.3 } };
class Engine {
  constructor(ctx, proj, bufs, lite = false) {
    const c = (this.ctx = ctx);
    this.lite = lite; this.stalls = 0;
    this.proj = proj; this.bufs = bufs; this.ch = {}; this.events = []; this.timer = null;
    this.curStep = 0; this.curTime = 0; this.sd = 60 / proj.bpm / 4; this.ks = new Map(); this.rr = {};
    this.last808 = null; this.openHat = null; this.satMap = new Map(); this.playing = false;
    this.p808 = proj.p808;
    // master bus: sum -> glue comp -> makeup -> fader -> limiter -> out
    this.masterIn = c.createGain();
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -18; this.comp.knee.value = 10; this.comp.ratio.value = 3; this.comp.attack.value = 0.03; this.comp.release.value = 0.2;
    this.makeup = c.createGain(); this.makeup.gain.value = 0.62;
    this.master = c.createGain();
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -4; this.limiter.knee.value = 0; this.limiter.ratio.value = 20; this.limiter.attack.value = 0.001; this.limiter.release.value = 0.06;
    this.masterIn.connect(this.comp); this.comp.connect(this.makeup); this.makeup.connect(this.master);
    // final soft clipper: nothing leaves above ~-0.4 dBFS
    this.clip = c.createWaveShaper(); const cv = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) { const x = (i * 2) / 4095 - 1, a = Math.abs(x); cv[i] = Math.sign(x) * (a < 0.8 ? a : 0.8 + 0.18 * Math.tanh((a - 0.8) / 0.18)); }
    this.clip.curve = cv;
    this.master.connect(this.limiter); this.limiter.connect(this.clip); this.clip.connect(c.destination);
    this.spec = c.createAnalyser(); this.spec.fftSize = 2048; this.spec.smoothingTimeConstant = 0.82; this.clip.connect(this.spec);
    const sp = c.createChannelSplitter(2);
    this.anL = c.createAnalyser(); this.anR = c.createAnalyser(); this.anL.fftSize = 512; this.anR.fftSize = 512;
    this.clip.connect(sp); sp.connect(this.anL, 0); sp.connect(this.anR, 1);
    // reverb send
    this.revIn = c.createGain(); const conv = (this.conv = c.createConvolver()); conv.buffer = lite ? makeIR(c, 1.3, 3.2, 1) : makeIR(c);
    const rg = c.createGain(); rg.gain.value = 0.8;
    this.revIn.connect(conv); conv.connect(rg); rg.connect(this.masterIn);
    // tempo-synced delay send (dotted 8th, darkened feedback)
    this.dlyIn = c.createGain(); this.dly = c.createDelay(2); this.dly.delayTime.value = (60 / proj.bpm) * 0.75;
    const fb = c.createGain(); fb.gain.value = 0.38; const lp = filt(c, 'lowpass', 3200); const dg = c.createGain(); dg.gain.value = 0.7;
    this.dlyIn.connect(this.dly); this.dly.connect(lp); lp.connect(fb); fb.connect(this.dly); lp.connect(dg); dg.connect(this.masterIn);
    // organ vibrato LFO
    this.vib = c.createOscillator(); this.vib.frequency.value = 6.1; this.vibG = c.createGain(); this.vibG.gain.value = 5;
    this.vib.connect(this.vibG); this.vib.start();
    for (const d of proj.channels) this.addStrip(d);
    this.syncMix(true);
  }
  addStrip(d) {
    const c = this.ctx;
    const input = c.createGain(), duck = c.createGain(), fader = c.createGain(), pan = c.createStereoPanner();
    const an = c.createAnalyser(); an.fftSize = 512;
    const sr = c.createGain(), sd = c.createGain();
    input.connect(duck); duck.connect(fader); fader.connect(pan); pan.connect(this.masterIn); pan.connect(an);
    pan.connect(sr); sr.connect(this.revIn); pan.connect(sd); sd.connect(this.dlyIn);
    this.ch[d.id] = { input, duck, fader, pan, an, sr, sd, buf: new Float32Array(512) };
  }
  syncMix(now) {
    const t = this.ctx.currentTime, tc = now ? 0.001 : 0.02, any = this.proj.channels.some(x => x.mix.solo);
    for (const d of this.proj.channels) {
      const e = this.ch[d.id], m = d.mix, on = !m.mute && (!any || m.solo);
      e.fader.gain.setTargetAtTime(on ? dbToGain(m.db) : 0, t, tc);
      e.pan.pan.setTargetAtTime(m.pan, t, tc);
      e.sr.gain.setTargetAtTime(m.rev * 0.9, t, tc);
      e.sd.gain.setTargetAtTime(m.dly * 0.9, t, tc);
    }
  }
  setLite(on) { this.lite = on; this.conv.buffer = on ? makeIR(this.ctx, 1.3, 3.2, 1) : makeIR(this.ctx); }
  setMaster(db) { this.master.gain.setTargetAtTime(dbToGain(db), this.ctx.currentTime, 0.02); }
  setGlue(on) { this.comp.ratio.setTargetAtTime(on ? 3 : 1, this.ctx.currentTime, 0.02); this.glueOn = on; }
  setTempo(bpm) { this.sd = 60 / bpm / 4; this.dly.delayTime.setTargetAtTime((60 / bpm) * 0.75, this.ctx.currentTime, 0.05); }
  peak(id) {
    const an = id === 'L' ? this.anL : id === 'R' ? this.anR : this.ch[id].an;
    const b = id === 'L' || id === 'R' ? (this._mb || (this._mb = new Float32Array(512))) : this.ch[id].buf;
    an.getFloatTimeDomainData(b); let p = 0;
    for (let i = 0; i < b.length; i++) { const a = Math.abs(b[i]); if (a > p) p = a; }
    return p;
  }

  /* ---- sequencer ---- */
  timeOf(x) {                                   // step position -> audio time, with swing
    const sd = this.sd, sw = this.proj.swing, ps = Math.floor(x / 2) * 2;
    const pt = this.curTime + (ps - this.curStep) * sd, w = x - ps, P = 2 * sd, off = P * (0.5 + sw * 0.25);
    return pt + (w < 1 ? w * off : off + (w - 1) * (P - off));
  }
  start() {
    if (this.playing) return;
    this.warm();                                           // build string samples first so it can't read as a stall
    this.playing = true; this.curStep = 0; this.curTime = this.ctx.currentTime + 0.08; this.events = []; this.stalls = 0;
    this.tick(); this.ticker = makeTicker(() => this.tick(), 25);
  }
  stop() {
    this.playing = false; if (this.ticker) this.ticker.stop(); this.ticker = null; this.last808 = null;
    const t = this.ctx.currentTime;
    for (const d of this.proj.channels) { const g = this.ch[d.id].input.gain; g.cancelScheduledValues(t); g.setTargetAtTime(0, t, 0.01); g.setTargetAtTime(1, t + 0.35, 0.005); }
  }
  tick() {
    const now = this.ctx.currentTime, lim = now + (this.lite ? 0.4 : 0.25), L = this.proj.bars * 16;
    if (this.curTime < now - 0.03) { this.curTime = now + 0.04; this.stalls++; this.last808 = null; }   // main thread stalled: re-sync instead of firing a burst of late notes
    while (this.curTime < lim) {
      this.sd = 60 / this.proj.bpm / 4;
      if (this.curStep >= L) this.curStep = 0;
      this.events.push({ t: this.curTime, s: this.curStep });
      this.scheduleStep();
      this.curTime += this.sd; this.curStep = (this.curStep + 1) % L;
    }
    if (this.events.length > 64) this.events.splice(0, this.events.length - 64);
  }
  warm() { for (const d of this.proj.channels) if (d.inst === 'pluck') for (const n of d.notes) this.ksBuf(n.n); }
  position() {                                  // fractional step for playhead, or -1
    if (!this.playing) return -1;
    const now = this.ctx.currentTime - (this.ctx.outputLatency || 0), ev = this.events;
    for (let i = ev.length - 1; i >= 0; i--) if (ev[i].t <= now) return ev[i].s + clamp((now - ev[i].t) / this.sd, 0, 1);
    return -1;
  }
  scheduleStep() {
    const P = this.proj, s = this.curStep, human = P.human, now = this.ctx.currentTime;
    for (const d of P.channels) {
      const e = this.ch[d.id];
      if (d.type === 'drum') {
        const v = d.v[s]; if (!(v > 0)) continue;
        const r = d.r[s] || 1;
        for (let k = 0; k < r; k++) {
          let vel = v;
          if (r > 1) { const u = k / (r - 1), sh = d.roll || 'flat'; vel *= sh === 'up' ? 0.45 + 0.55 * u : sh === 'down' ? 1 - 0.55 * u : 1; }
          vel = clamp(vel + (Math.random() - 0.5) * human * 0.14, 0.05, 1);
          const jit = d.drum === 'kick' ? 0 : (Math.random() - 0.5) * human * 0.012;
          const t = Math.max(now, this.timeOf(s + k / r) + jit);
          this.playDrum(d, e, t, vel);
          if (d.drum === 'kick') this.duck(t);
        }
      } else {
        let chordN = 0;
        for (const n of d.notes) {
          if (Math.floor(n.t + 1e-6) !== s) continue;
          if (this.lite && d.inst !== 'sub' && ++chordN > 3) continue;       // Lite: chords keep three voices
          const t = Math.max(now, this.timeOf(n.t)), end = this.timeOf(n.t + n.d);
          const vel = clamp(n.v + (Math.random() - 0.5) * human * 0.1, 0.05, 1);
          this.note(d, e, t, n.n, vel, Math.max(0.04, end - t), n.s);
        }
      }
    }
  }
  runOffline(nSteps, t0 = 0.05) {               // schedule a whole span (used by tests / future export)
    this.curStep = 0; this.curTime = t0; const L = this.proj.bars * 16;
    for (let i = 0; i < nSteps; i++) {
      this.sd = 60 / this.proj.bpm / 4; this.scheduleStep(); this.curTime += this.sd; this.curStep = (this.curStep + 1) % L;
    }
  }
  duck(t) {
    for (const d of this.proj.channels) {
      const a = d.mix.duck; if (!a) continue;
      const g = this.ch[d.id].duck.gain;
      g.setTargetAtTime(1 - a * 0.8, t, 0.004); g.setTargetAtTime(1, t + 0.025, 0.085);
    }
  }
  preview(d, midi) {
    const t = this.ctx.currentTime + 0.005, e = this.ch[d.id];
    if (d.type === 'drum') this.playDrum(d, e, t, 0.9); else this.note(d, e, t, midi, 0.8, 0.45, false);
  }

  /* ---- voices ---- */
  playDrum(d, e, t, vel) {
    const arr = this.bufs[d.drum]; let i = 0;
    if (arr.length > 1) { const last = this.rr[d.id] ?? -1; do { i = Math.floor(Math.random() * arr.length); } while (i === last); this.rr[d.id] = i; }
    const s = this.ctx.createBufferSource(); s.buffer = arr[i];
    s.playbackRate.value = 1 + (Math.random() - 0.5) * 0.02 * (this.proj.human * 2 + 0.3);
    const g = this.ctx.createGain(); g.gain.value = 0.12 + 0.88 * Math.pow(vel, 1.5);
    s.connect(g); g.connect(e.input); s.start(t);
    if (d.drum === 'hat' && this.openHat) { this.openHat.gain.setTargetAtTime(0, t, 0.006); this.openHat = null; }   // hat choke
    if (d.drum === 'ohat') this.openHat = g;
  }
  satFor(k) { const key = k.toFixed(2); if (!this.satMap.has(key)) this.satMap.set(key, satCurve(k)); return this.satMap.get(key); }
  note(d, e, t, m, vel, dur, slide) {
    switch (d.inst) {
      case 'sub': return this.v808(e, t, m, vel, dur, slide);
      case 'rhodes': return this.vRhodes(e, t, m, vel, dur);
      case 'pluck': return this.vPluck(e, t, m, vel, dur);
      case 'pad': return this.vPad(e, t, m, vel, dur);
      case 'organ': return this.vOrgan(e, t, m, vel, dur);
      case 'chop': return this.vChop(e, t, m, vel, dur);
      case 'sampler': return this.vSampler(e, t, m, vel, dur);
    }
  }
  v808(e, t, m, vel, dur, slide) {
    const c = this.ctx, p = this.p808, f = mtof(m), end = t + Math.max(dur, 0.06), lvl = 0.55 + 0.45 * vel, L = this.last808;
    if (slide && L && L.stop > t && L.end >= t - 0.05) {          // glide the sounding voice, keep one continuous tone
      const est = L.l0 * Math.exp(-Math.max(0, t - L.ts) / L.tau), boost = Math.max(est, lvl * 0.8);
      L.osc.frequency.cancelScheduledValues(t); L.osc.frequency.setValueAtTime(L.f, t); L.osc.frequency.exponentialRampToValueAtTime(f, t + p.glide);
      L.A.gain.cancelScheduledValues(t); L.A.gain.setValueAtTime(est, t); L.A.gain.linearRampToValueAtTime(boost, t + 0.03); L.A.gain.setTargetAtTime(0, t + 0.03, p.decay);
      L.G.gain.cancelScheduledValues(L.end); L.G.gain.setTargetAtTime(0, end, 0.045);
      L.osc.stop(end + 0.4);
      L.f = f; L.end = end; L.stop = end + 0.4; L.l0 = boost; L.ts = t + 0.03; L.tau = p.decay;
      return;
    }
    if (L && L.end > t) { L.G.gain.cancelScheduledValues(L.end); L.G.gain.setTargetAtTime(0, Math.max(0, t - 0.004), 0.004); }   // mono: cut previous
    const osc = c.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(f * 2.5, t); osc.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    const A = c.createGain(); A.gain.setValueAtTime(0, t); A.gain.linearRampToValueAtTime(lvl, t + 0.003); A.gain.setTargetAtTime(0, t + 0.003, p.decay);
    const sh = c.createWaveShaper(); sh.curve = this.satFor(p.drive); sh.oversample = this.lite ? 'none' : '2x';
    const post = c.createGain(); post.gain.value = 0.8;
    const G = c.createGain(); G.gain.setValueAtTime(1, t); G.gain.setTargetAtTime(0, end, 0.04);
    osc.connect(A); A.connect(sh); sh.connect(post); post.connect(G); G.connect(e.input);
    osc.start(t); osc.stop(end + 0.4);
    this.last808 = { osc, A, G, f, end, stop: end + 0.4, l0: lvl, ts: t + 0.003, tau: p.decay };
  }
  vRhodes(e, t, m, vel, dur) {
    const c = this.ctx, f = mtof(m), end = t + dur, out = c.createGain(), stopT = end + (this.lite ? 0.5 : 0.75);   // oscillators stop once the release has faded (-40 dB)
    const car = c.createOscillator(); car.frequency.value = f;
    const mod = c.createOscillator(); mod.frequency.value = f; const mg = c.createGain();
    mg.gain.setValueAtTime(f * (0.35 + vel * 1.5), t); mg.gain.exponentialRampToValueAtTime(f * 0.1, t + 0.7);
    mod.connect(mg); mg.connect(car.frequency);
    const tine = c.createOscillator(); tine.frequency.value = Math.min(f * 4, 9000); const tg = c.createGain();
    tg.gain.setValueAtTime(vel * 0.22, t); tg.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    tine.connect(tg); tg.connect(out); tine.start(t); tine.stop(t + 0.3);
    car.connect(out);
    adsr(out.gain, t, 0.22 + 0.2 * vel, 0.004, 0.55, 0.28, end, 0.14);
    out.connect(e.input);
    car.start(t); car.stop(stopT); mod.start(t); mod.stop(stopT);
    if (!this.lite && m < 60) { const sub = c.createOscillator(); sub.frequency.value = f * 0.5; const sg = c.createGain(); sg.gain.value = 0.12; sub.connect(sg); sg.connect(out); sub.start(t); sub.stop(stopT); }
  }
  vPad(e, t, m, vel, dur) {
    const c = this.ctx, f = mtof(m), end = t + dur, out = c.createGain(), lp = filt(c, 'lowpass', Math.min(7000, f * 3 + 500), 0.7), rel = this.lite ? 0.4 : 0.5, stopT = end + rel * 5;
    (this.lite ? [-7, 7] : [-9, 0, 9]).forEach(cents => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = cents; const g = c.createGain(); g.gain.value = this.lite ? 0.5 : 0.34; o.connect(g); g.connect(lp); o.start(t); o.stop(stopT); });
    adsr(out.gain, t, 0.16 * (0.5 + vel * 0.5), 0.35, 0.6, 0.85, end, rel);
    lp.connect(out); out.connect(e.input);
  }
  vOrgan(e, t, m, vel, dur) {
    const c = this.ctx, f = mtof(m), end = t + dur, out = c.createGain(), vib = !this.lite && dur > 0.35;   // vibrato only where you can hear it: it makes each oscillator audio-rate modulated
    (this.lite ? [[1, 1], [2, 0.8], [3, 0.5]] : [[0.5, 0.35], [1, 1], [2, 0.8], [3, 0.5], [4, 0.35], [6, 0.18]]).forEach(([r, a]) => {
      const o = c.createOscillator(); o.frequency.value = f * r; if (vib) this.vibG.connect(o.detune);
      const g = c.createGain(); g.gain.value = a * 0.14; o.connect(g); g.connect(out); o.start(t); o.stop(end + 0.32);
    });
    adsr(out.gain, t, 0.3 * (0.5 + vel * 0.5), 0.008, 0.2, 0.9, end, 0.05);
    out.connect(e.input);
  }
  /* ---- sampler voices: chops (note = slice) and zone-based instruments (note = pitch) ---- */
  chopPreview(i) { const e = this.ch.chops; if (e) this.vChop(e, this.ctx.currentTime + 0.005, 36 + i, 0.9, 10); }
  vChop(e, t, m, vel, dur) {
    const cl = LIB.chop, i = m - 36; if (!cl || i < 0 || i >= cl.slices.length) return;
    const c = this.ctx, D = cl.buf.duration, rate = Math.pow(2, (cl.pitch || 0) / 12);
    let a = cl.slices[i], b = i + 1 < cl.slices.length ? cl.slices[i + 1] : D, buf = cl.buf;
    if (cl.reverse && cl.rev) { buf = cl.rev; const na = D - b; b = D - a; a = na; }
    const len = (b - a) / rate, play = cl.gate ? Math.min(len, Math.max(dur, 0.03)) : len;
    const s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const g = c.createGain(), pk = 0.3 + 0.7 * vel;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 0.002);
    g.gain.setValueAtTime(pk, t + Math.max(0.003, play - 0.008)); g.gain.linearRampToValueAtTime(0, t + Math.max(0.006, play));
    s.connect(g); g.connect(e.input); s.start(t, a, b - a); s.stop(t + play + 0.02);
  }
  pickZone(m) {
    let best = null, bd = 1e9;
    for (const z of LIB.inst.zones) { const d = m < z.lo ? z.lo - m : m > z.hi ? m - z.hi : 0, k = d * 100 + Math.abs(m - z.root); if (k < bd) { bd = k; best = z; } }
    return best;
  }
  vSampler(e, t, m, vel, dur) {
    const z = this.pickZone(m); if (!z || !z.buf) return;
    const c = this.ctx, P = LIB.inst, end = t + Math.max(dur, 0.03), rel = Math.max(0.02, P.release), att = Math.max(0.002, P.attack);
    const s = c.createBufferSource(); s.buffer = z.buf; s.playbackRate.value = Math.pow(2, (m - z.root) / 12);
    if (z.loop && z.le > z.ls) { s.loop = true; s.loopStart = z.ls; s.loopEnd = z.le; }
    const g = c.createGain(), pk = (0.25 + 0.75 * vel) * (z.gain || 1);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + att); g.gain.setTargetAtTime(0, Math.max(end, t + att + 0.002), rel / 3);
    s.connect(g); g.connect(e.input); s.start(t); s.stop(end + rel * 2 + 0.05);
  }
  ksBuf(m) {
    const key = m + '@' + this.ctx.sampleRate; if (this.ks.has(key)) return this.ks.get(key);
    const sr = this.ctx.sampleRate, f = mtof(m), D = sr / f - 0.5, Di = Math.floor(D), fr = D - Di, len = Math.floor(sr * (this.lite ? 1.3 : 1.8)), y = new Float32Array(len);
    let s = (m * 7919 + 1) >>> 0, lp = 0;
    for (let i = 0; i < Di + 2 && i < len; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; lp += ((s / 4294967296) * 2 - 1 - lp) * 0.6; y[i] = lp; }
    let prev = 0;
    for (let i = Di + 2; i < len; i++) { const v = (1 - fr) * y[i - Di] + fr * y[i - Di - 1]; y[i] = 0.5 * (v + prev) * 0.9985; prev = v; }
    let pk = 0; for (let i = 0; i < len; i++) { const a = Math.abs(y[i]); if (a > pk) pk = a; }
    const b = this.ctx.createBuffer(1, len, sr), d = b.getChannelData(0), g = pk ? 0.8 / pk : 1;
    for (let i = 0; i < len; i++) d[i] = y[i] * g;
    this.ks.set(key, b); return b;
  }
  vPluck(e, t, m, vel, dur) {
    const c = this.ctx, end = t + dur, s = c.createBufferSource(); s.buffer = this.ksBuf(m);
    const lp = filt(c, 'lowpass', 2200 + vel * 4200, 0.6), g = c.createGain();
    g.gain.setValueAtTime(0.35 + 0.65 * vel, t); g.gain.setTargetAtTime(0, end, 0.05);     // short note = palm-muted
    s.connect(lp); lp.connect(g); g.connect(e.input); s.start(t); s.stop(end + 0.5);
  }
}
async function renderOffline(proj, bufs, seconds) {
  const sr = 44100, oc = new OfflineAudioContext(2, Math.floor(sr * seconds), sr);
  const eng = new Engine(oc, proj, bufs);
  eng.runOffline(Math.ceil(seconds / (60 / proj.bpm / 4)));
  return oc.startRendering();
}

function makeTicker(fn, ms) {
  try {
    const url = URL.createObjectURL(new Blob(['let t=setInterval(()=>postMessage(0),' + ms + ');onmessage=()=>{clearInterval(t);close()}'], { type: 'text/javascript' }));
    const w = new Worker(url); w.onmessage = fn;
    return { stop() { try { w.postMessage(0); w.terminate(); URL.revokeObjectURL(url); } catch (e) {} } };
  } catch (err) {
    const id = setInterval(fn, ms); return { stop() { clearInterval(id); } };
  }
}

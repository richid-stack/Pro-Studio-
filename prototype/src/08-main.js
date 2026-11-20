/* ===== Forge main: transport, presets, keyboard, animation loop ===== */
const drumsReady = prerenderDrums().then(b => (drumBufs = b));
let kSwing, kHuman;

function applyProject(np) {
  P = np; if (P.masterDb == null) P.masterDb = 0;
  if (eng) { eng.proj = P; eng.p808 = P.p808; eng.last808 = null; eng.setTempo(P.bpm); eng.setMaster(P.masterDb); eng.syncMix(); }
  if (!chOf(sel.inst)) sel.inst = 'bass'; if (!chOf(sel.drum)) sel.drum = 'hat';
  syncTransportUI(); buildRack(); buildMixer(); rollLayout(); rollSetChannel(); syncKnobs808();
}
function syncTransportUI() {
  $('bpm').value = P.bpm; kSwing.set(P.swing); kHuman.set(P.human); $('genre').value = P.genre; $('key').value = P.key; $('scale').value = P.scale;
  $('bars').value = P.bars; $('lock').setAttribute('aria-pressed', P.lock);
}
function loadPreset(key) {
  hist.push(JSON.stringify(P));                      // whole-project snapshot so Undo can bring the old beat back
  const wasPlaying = eng && eng.playing;
  applyProject(makeProject(key));
  if (wasPlaying) { eng.curStep = 0; }
  saveSoon();
}
function setBars(n) {
  const old = P.bars; if (n === old) return; snapshot();
  if (n > old) {
    const oL = old * 16, nL = n * 16;
    for (const d of P.channels) {
      if (d.type === 'drum') { if (d.v.slice(oL, nL).every(v => !v)) for (let i = oL; i < nL; i++) { d.v[i] = d.v[i % oL]; d.r[i] = d.r[i % oL]; } }
      else if (!d.notes.some(x => x.t >= oL)) { const base = d.notes.filter(x => x.t < oL).map(x => ({ ...x })); for (let k = 1; k * oL < nL; k++) base.forEach(x => d.notes.push({ ...x, id: _nid++, t: x.t + k * oL })); }
    }
  }
  P.bars = n; if (eng && eng.curStep >= n * 16) eng.curStep = 0;
  buildRack(); rollLayout(); rollSetChannel(); saveSoon();
}
async function togglePlay() {
  const en = await ensureEngine();
  if (en.playing) en.stop(); else { en.ctx.resume(); en.start(); }
  setPlayUI(en.playing);
}
function setPlayUI(on) {
  $('btnPlay').setAttribute('aria-pressed', on); $('icoPlay').hidden = on; $('icoStop').hidden = !on;
  if (!on) { $('phead').style.display = 'none'; $('rphead').style.display = 'none'; $('readout').innerHTML = '001<small>.</small>1<small>.</small>1'; }
}

function initTransport() {
  const ks = $('key'); NOTE_NAMES.forEach((n, i) => ks.add(new Option(n, i)));
  const sc = $('scale'); Object.keys(SCALES).forEach(k => sc.add(new Option(SCALE_LABELS[k], k)));
  kSwing = Knob($('kSwing'), { min: 0, max: 1, val: P.swing, def: 0, label: 'Swing', fmt: v => Math.round(v * 100) + '%', onInput: v => { P.swing = v; saveSoon(); } });
  kHuman = Knob($('kHuman'), { min: 0, max: 1, val: P.human, def: 0.2, label: 'Humanize', fmt: v => Math.round(v * 100) + '%', onInput: v => { P.human = v; saveSoon(); } });
  $('btnPlay').onclick = togglePlay;
  $('bpm').onchange = e => { P.bpm = clamp(Math.round(+e.target.value) || 120, 60, 200); e.target.value = P.bpm; if (eng) eng.setTempo(P.bpm); saveSoon(); };
  $('genre').onchange = e => loadPreset(e.target.value);
  ks.onchange = () => { P.key = +ks.value; bgRebuild(); saveSoon(); };
  sc.onchange = () => { P.scale = sc.value; bgRebuild(); saveSoon(); };
  $('lock').onclick = () => { P.lock = !P.lock; $('lock').setAttribute('aria-pressed', P.lock); saveSoon(); };
  $('bars').onchange = e => setBars(+e.target.value);
  $('btnUndo').onclick = doUndo;
  $('rphead').style.left = '0px';
  $('lite').onclick = () => setLite(!ui.lite);
  $('lite').setAttribute('aria-pressed', ui.lite);
}
const START_MSG = 'Press Play (or Space) to start the audio engine';
function toast(msg, ms) { const n = $('startNote'); n.textContent = msg; n.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { if (eng && eng.ctx.state === 'running') n.hidden = true; else n.textContent = START_MSG; }, ms || 3500); }
function setLite(on, auto) {
  ui.lite = on; if (!auto) { ui.stallLimit = on ? 3 : 8; if (eng) eng.stalls = 0; }     // choosing full quality by hand: be slower to override it
  $('lite').setAttribute('aria-pressed', on); try { localStorage.setItem('forge.lite', on ? '1' : '0'); } catch (e) {}
  if (eng) eng.setLite(on);
  if (auto) toast('Switched to Lite audio to keep playback steady');
}
// phones suspend audio when the screen sleeps or a call comes in: any tap brings it back
document.addEventListener('pointerdown', () => { if (eng && eng.ctx.state !== 'running') eng.ctx.resume(); }, true);
document.addEventListener('visibilitychange', () => { if (!document.hidden && eng && eng.playing) eng.ctx.resume(); });
function doUndo() {
  const s = hist[hist.length - 1]; if (!s) return;
  if (s[0] === '{') { hist.pop(); applyProject(JSON.parse(s)); saveSoon(); } else undo();
}

/* ---- keyboard ---- */
const typing = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
document.addEventListener('keydown', e => {
  if (typing(e)) return;
  const mod = e.ctrlKey || e.metaKey;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); }
  else if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); R.sel = new Set(R.ch.notes.map(n => n.id)); rollRedraw(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
  else if (!mod && e.key.toLowerCase() === 's') toggleSlide();
  else if (!mod && e.key.toLowerCase() === 'q') quantize();
});
document.addEventListener('keyup', e => { if (e.code === 'Space' && !typing(e)) e.preventDefault(); });

/* ---- animation loop: playhead, readout, meters, spectrum ---- */
const specCv = () => $('spec');
let specBins = null;
function drawSpectrum() {
  const cv = specCv(), x = cv.getContext('2d'), W = cv.width, H = cv.height;
  x.clearRect(0, 0, W, H);
  if (!eng) return;
  if (!specBins) specBins = new Uint8Array(eng.spec.frequencyBinCount);
  eng.spec.getByteFrequencyData(specBins);
  const nb = 42, hz = eng.ctx.sampleRate / eng.spec.fftSize, bw = W / nb;
  for (let k = 0; k < nb; k++) {
    const f0 = 28 * Math.pow(17000 / 28, k / nb), f1 = 28 * Math.pow(17000 / 28, (k + 1) / nb);
    let a = Math.floor(f0 / hz), b = Math.max(a + 1, Math.floor(f1 / hz)), mx = 0;
    for (let i = a; i < b && i < specBins.length; i++) mx = Math.max(mx, specBins[i]);
    const h = Math.pow(mx / 255, 1.5) * (H - 4);
    x.fillStyle = k < nb * 0.25 ? '#c58cff' : k < nb * 0.6 ? '#ffae3d' : '#6fe0b0';
    x.globalAlpha = 0.9; x.fillRect(k * bw + 1, H - h, bw - 2, h);
  }
  x.globalAlpha = 1;
}
let fcount = 0;
function frame() {
  fcount++;
  if (eng) {
    const pos = eng.position();
    if (pos >= 0) {
      $('phead').style.display = 'block'; $('phead').style.transform = 'translateX(' + (2 + pos * CELL - 1) + 'px)';
      $('rphead').style.display = 'block'; $('rphead').style.transform = 'translateX(' + (R.keyW + pos * R.pps - 1) + 'px)';
      const st = Math.floor(pos), bar = Math.floor(st / 16) + 1, beat = Math.floor((st % 16) / 4) + 1, sub = (st % 4) + 1;
      $('readout').innerHTML = String(bar).padStart(3, '0') + '<small>.</small>' + beat + '<small>.</small>' + sub;
    }
    if (eng.playing && !ui.lite && eng.stalls >= (ui.stallLimit || 3)) setLite(true, true);       // the scheduler keeps missing deadlines: lighten up automatically
    $('lite').title = 'Lighter reverb and fewer voices, for phones. Scheduler stalls: ' + eng.stalls;
    const metering = !ui.lite || fcount % 3 === 0;
    if (metering) for (const d of P.channels) { const s = strips[d.id]; if (s) meterFeed(s.meter, s.st, eng.peak(d.id)); }
    if (masterUI && metering) {
      const l = eng.peak('L'), r = eng.peak('R');
      meterFeed(masterUI.L, masterUI.stL, l); meterFeed(masterUI.R, masterUI.stR, r); meterFeed($('mmL'), $('mmL')._s || ($('mmL')._s = {}), l); meterFeed($('mmR'), $('mmR')._s || ($('mmR')._s = {}), r);
      masterUI.gr.textContent = 'GR ' + Math.abs(eng.comp.reduction || 0).toFixed(1);
    }
    if (!ui.lite) drawSpectrum();
  }
  requestAnimationFrame(frame);
}

function boot() {
  P = loadSaved() || makeProject('trap');
  if (P.masterDb == null) P.masterDb = 0;
  initTransport(); syncTransportUI();
  buildRack(); initRackEvents(); buildMixer(); initRoll(); rollSetChannel(); syncKnobs808();
  initSampler(); restoreLib();
  let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { rollLayout(); laneSize(); laneDraw(); }, 120); });
  requestAnimationFrame(() => { rollLayout(); rollSetChannel(); });
  requestAnimationFrame(frame);
  window.__forge = { get P() { return P; }, get eng() { return eng; }, ensureEngine, togglePlay, loadPreset, S, LIB, SLIB, addFiles, selectClip, layOut, restoreLib };
}
boot();

/* ===== Sampler interface: import, waveform, cuts, pads, instrument maker, drum override ===== */
const S = { clip: null, vs: 0, vd: 1, sel: -1, cursor: null, zi: -1, sens: 0.55, autoOn: false, src: null, drag: null, opt: { pitch: 0, reverse: false, gate: false } };
const MAXPADS = 16, MAXSEC = 90, MAXCLIPS = 12, MAXZONES = 24, WAVE_H = 150;
const smpK = {};
let _zid = 1;
const newId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clipDur = () => (S.clip ? S.clip.buf.duration : 0);
const cutEnd = i => (S.clip && i + 1 < S.clip.slices.length ? S.clip.slices[i + 1] : clipDur());
const libSaveSoon = () => { clearTimeout(S.lt); S.lt = setTimeout(saveLibState, 400); };
const stem = n => String(n).replace(/\.[^.]+$/, '');

/* ---------- markup ---------- */
const SMP_HTML = `
<div class="smp-top">
  <div class="smp-main">
    <div class="smp-bar">
      <label class="tb file" title="Choose audio files from your device">Import audio<input type="file" id="smpFile" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac,.aif,.aiff" multiple></label>
      <select class="sel" id="smpClip" aria-label="Clip" style="max-width:220px"></select>
      <button class="tb" id="smpPlay" title="Play the whole clip">Play</button>
      <button class="tb" id="smpDel" title="Remove this clip from your library">Remove</button>
      <span class="hint" id="smpInfo"></span>
    </div>
    <div class="wave-wrap" id="waveWrap">
      <canvas id="wave" aria-label="Waveform. Click a slice to hear it, drag a marker to move it, double-click to add a cut."></canvas>
      <div class="wave-empty" id="waveEmpty"><div><b>Drop an audio file here</b><br>or press Import audio. Chop it, play it on pads, or turn it into an instrument.<br><small>Only use audio you own or have cleared.</small></div></div>
    </div>
    <input type="range" id="smpPan" min="0" max="1000" value="0" aria-label="Scroll waveform" hidden>
    <div class="smp-bar">
      <button class="tb" id="smpAuto" title="Find the hits in the audio and cut before each one">Auto-chop</button>
      <label class="kn"><span>Sens</span><div class="knob sm" id="kSens"></div></label>
      <div class="seg" id="smpEven" role="group" aria-label="Even cuts">
        <button data-n="4">¼</button><button data-n="8">⅛</button><button data-n="16">1/16</button>
      </div>
      <button class="tb" id="smpHere" title="Add a cut at the last place you clicked">Cut here</button>
      <button class="tb" id="smpCut" title="Delete the selected cut">Delete cut</button>
      <button class="tb" id="smpClr" title="Keep a single slice">Clear cuts</button>
      <div class="sp"></div>
      <button class="tb" id="zOut" aria-label="Zoom out">−</button><button class="tb" id="zIn" aria-label="Zoom in">+</button><button class="tb" id="zFit">Fit</button>
    </div>
    <div class="smp-bar">
      <button class="tb" id="smpRev" aria-pressed="false" title="Play the slices backwards">Reverse</button>
      <button class="tb" id="smpGate" aria-pressed="false" title="Cut each slice off when its note ends">Gate</button>
      <label class="kn"><span>Pitch</span><div class="knob sm" id="kPitch"></div><output id="pitchOut" class="out">0 st</output></label>
    </div>
  </div>
  <div class="smp-side">
    <h3>Pads</h3>
    <div class="pads" id="pads"></div>
    <button class="tb hot" id="smpLay" title="Write the slices onto the Chops channel in the piano roll">Lay out on piano roll</button>
    <p class="hint">Pads play the numbered slices. Lay-out spaces the cuts across the pattern so you can rearrange them in the roll; turn Gate on to cut each slice at the note end.</p>
  </div>
</div>

<div class="smp-sec">
  <h3>Instrument maker <span class="hint">turns a sample into a keyboard instrument on the Sampler channel</span></h3>
  <div class="smp-bar">
    <button class="tb" id="instAddCut" title="Make a zone from the selected slice">Add selected cut</button>
    <button class="tb" id="instAddAll" title="Make a zone from the whole clip">Add whole clip</button>
    <button class="tb" id="instAuto" title="Spread the zones across the keyboard">Auto-range</button>
    <button class="tb" id="instClr">Clear zones</button>
    <div class="sp"></div>
    <label class="kn"><span>Attack</span><div class="knob sm" id="kAtt"></div></label>
    <label class="kn"><span>Release</span><div class="knob sm" id="kRel"></div></label>
  </div>
  <div class="zones" id="zones" role="list"></div>
  <div class="smp-bar zctl" id="zctl">
    <label class="kn"><span>Root</span><select class="sel" id="zRoot"></select></label>
    <button class="tb" id="zDetect" title="Listen to the sample and set its root note">Detect</button>
    <label class="kn"><span>From</span><select class="sel" id="zLo"></select></label>
    <label class="kn"><span>To</span><select class="sel" id="zHi"></select></label>
    <button class="tb" id="zLoop" aria-pressed="false" title="Sustain the sample for as long as the key is held">Loop</button>
    <button class="tb" id="zTry">Try it</button>
  </div>
</div>

<div class="smp-sec">
  <h3>Drum sounds <span class="hint">put your own hit into the channel rack</span></h3>
  <div class="smp-bar">
    <label class="kn"><span>Replace</span><select class="sel" id="drmSel"></select></label>
    <button class="tb" id="drmCut">With selected cut</button>
    <button class="tb" id="drmClip">With whole clip</button>
    <button class="tb" id="drmReset">Back to built-in</button>
    <span class="hint" id="drmList"></span>
  </div>
</div>`;

/* ---------- clip handling ---------- */
async function makeClipObj(id, name, bytes) {
  let buf = await decodeBytes(bytes), trimmed = false;
  if (buf.duration > MAXSEC) { buf = sliceCopy(buf, 0, MAXSEC); trimmed = true; }
  return { id, name, bytes, buf, slices: [], trimmed };
}
async function addFiles(list) {
  const files = [...list].filter(f => /^audio\//.test(f.type) || /\.(wav|mp3|m4a|aac|ogg|oga|opus|flac|aif|aiff|webm)$/i.test(f.name));
  if (!files.length) { toast('That is not an audio file. Try WAV, MP3, M4A, OGG or FLAC.'); return; }
  setTab('sampler');
  let last = null;
  for (const f of files.slice(0, 8)) {
    if (SLIB.clips.length >= MAXCLIPS) { toast('Library is full (' + MAXCLIPS + ' clips). Remove one first.'); break; }
    if (f.size > 60e6) { toast(f.name + ' is over 60 MB'); continue; }
    try {
      const c = await makeClipObj(newId(), f.name, await f.arrayBuffer());
      c.slices = detectOnsets(c.buf, S.sens, MAXPADS); S.autoOn = true;
      SLIB.clips.push(c); saveClip(c); last = c;
      if (c.trimmed) toast('Long file: using the first ' + MAXSEC + ' seconds');
    } catch (e) { toast('Could not read ' + f.name + '. Try a WAV or MP3.'); }
  }
  if (last) selectClip(last.id);
}
function selectClip(id) {
  stopRaw();
  S.clip = SLIB.clips.find(c => c.id === id) || null;
  S.sel = S.clip && S.clip.slices.length ? 0 : -1; S.cursor = null; fitView();
  renderClips(); applyChop(); updatePads(); drawWave(); libSaveSoon();
}
function removeClip() {
  const c = S.clip; if (!c) return;
  stopRaw();
  LIB.inst.zones = LIB.inst.zones.filter(z => z.clipId !== c.id); S.zi = Math.min(S.zi, LIB.inst.zones.length - 1);
  for (const k of Object.keys(SLIB.drums)) if (SLIB.drums[k].clipId === c.id) resetDrum(k, true);
  SLIB.clips = SLIB.clips.filter(x => x !== c); idbDel('clips', c.id);
  renderZones(); renderDrums();
  selectClip(SLIB.clips.length ? SLIB.clips[SLIB.clips.length - 1].id : null);
}
function applyChop() {
  const c = S.clip;
  if (!c) LIB.chop = null;
  else {
    if (S.opt.reverse && !c.rev) c.rev = reversedCopy(c.buf);
    LIB.chop = { buf: c.buf, rev: c.rev || null, slices: c.slices, pitch: S.opt.pitch, reverse: S.opt.reverse, gate: S.opt.gate };
  }
  try { rollRedraw(); const ch = chOf('chops'); if (ch) drawThumb(ch); } catch (e) {}
}
function cutsChanged(persist) { applyChop(); updatePads(); drawWave(); updateInfo(); if (persist !== false && S.clip) { saveClip(S.clip); libSaveSoon(); } }

/* ---------- cuts ---------- */
function snapZero(t) {                                            // nearest rising zero crossing within 4 ms, so cuts don't click
  const c = S.clip; if (!c) return t;
  const d = c.mono || (c.mono = monoOf(c.buf)), sr = c.buf.sampleRate, i0 = Math.floor(t * sr), w = Math.floor(0.004 * sr);
  for (let k = 0; k <= w; k++) for (const i of [i0 - k, i0 + k]) if (i > 0 && i < d.length && d[i - 1] <= 0 && d[i] > 0) return i / sr;
  return t;
}
function addCut(t) {
  const c = S.clip; if (!c) return;
  if (c.slices.length >= MAXPADS) { toast('16 cuts is the most (one per pad)'); return; }
  t = snapZero(clamp(t, 0, clipDur() - 0.02));
  if (c.slices.some(s => Math.abs(s - t) < 0.015)) return;
  c.slices.push(t); c.slices.sort((a, b) => a - b); S.sel = c.slices.indexOf(t); S.autoOn = false;
  cutsChanged(); audition(S.sel);
}
function removeCut(i) {
  const c = S.clip; if (!c || c.slices.length < 2 || i < 0) return;
  c.slices.splice(i, 1); S.sel = Math.min(i, c.slices.length - 1); S.autoOn = false; cutsChanged();
}
function autoChop(quiet) {
  const c = S.clip; if (!c) return;
  c.slices = detectOnsets(c.buf, S.sens, MAXPADS); S.autoOn = true; S.sel = Math.min(Math.max(S.sel, 0), c.slices.length - 1); cutsChanged();
  if (!quiet && c.slices.length < 3) toast('Found only ' + c.slices.length + ' hit' + (c.slices.length === 1 ? '' : 's') + '. Turn Sens up or use an even split.');
}
function evenChop(n) { const c = S.clip; if (!c) return; c.slices = evenSlices(c.buf.duration, n); S.autoOn = false; S.sel = 0; cutsChanged(); }
function audition(i) { if (i >= 0) ensureEngine().then(en => en.chopPreview(i)); }

/* ---------- raw playback (whole clip) ---------- */
function stopRaw() { if (S.src) { try { S.src.stop(); } catch (e) {} S.src = null; } const b = $('smpPlay'); if (b) b.textContent = 'Play'; }
function playRaw() {
  if (S.src) { stopRaw(); return; }
  const c = S.clip; if (!c) return;
  ensureEngine().then(en => {
    const s = en.ctx.createBufferSource(); s.buffer = c.buf; s.connect(en.ch.chops.input); s.start(0); S.src = s; $('smpPlay').textContent = 'Stop';
    s.onended = () => { if (S.src === s) { S.src = null; $('smpPlay').textContent = 'Play'; } };
  });
}

/* ---------- waveform ---------- */
function fitView() { S.vs = 0; S.vd = Math.max(0.05, clipDur() || 1); panSync(); }
function panSync() {
  const p = $('smpPan'), D = clipDur(), room = D - S.vd;
  if (!p) return; p.hidden = !(S.clip && room > 1e-3); p.value = room > 1e-3 ? Math.round((S.vs / room) * 1000) : 0;
}
function zoomBy(f, cx) {
  const D = clipDur(); if (!D) return; cx = cx == null ? 0.5 : cx;
  const nd = clamp(S.vd * f, Math.min(0.02, D), D), t = S.vs + S.vd * cx;
  S.vs = clamp(t - nd * cx, 0, Math.max(0, D - nd)); S.vd = nd; panSync(); drawWave();
}
function waveSize() {
  const cv = $('wave'), w = $('waveWrap').clientWidth, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (!w) return false;
  if (cv._w !== w || cv._d !== dpr) { cv.width = w * dpr; cv.height = WAVE_H * dpr; cv.style.width = w + 'px'; cv.style.height = WAVE_H + 'px'; cv._w = w; cv._d = dpr; }
  return true;
}
function drawWave() {
  if ($('sampler').hidden || !waveSize()) return;
  const cv = $('wave'), x = cv.getContext('2d'), W = cv._w, H = WAVE_H, dpr = cv._d;
  x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
  $('waveEmpty').hidden = !!S.clip;
  const c = S.clip; if (!c) return;
  const sr = c.buf.sampleRate, d = c.mono || (c.mono = monoOf(c.buf)), vs = S.vs, vd = S.vd, spp = (vd * sr) / W;
  c.slices.forEach((t, i) => {
    const x0 = ((t - vs) / vd) * W, x1 = ((cutEnd(i) - vs) / vd) * W; if (x1 < 0 || x0 > W) return;
    x.fillStyle = i === S.sel ? 'rgba(255,174,61,.20)' : i & 1 ? 'rgba(88,208,255,.05)' : 'rgba(88,208,255,.11)';
    x.fillRect(Math.max(0, x0), 0, Math.min(W, x1) - Math.max(0, x0), H);
  });
  x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, H / 2, W, 1);
  const mid = H / 2, amp = H / 2 - 8, step = Math.max(1, Math.floor(spp / 48)); x.fillStyle = '#58d0ff';
  for (let px = 0; px < W; px++) {
    const a = Math.floor(vs * sr + px * spp); if (a >= d.length) break;
    const b = Math.min(d.length, Math.max(a + 1, Math.floor(a + spp) + 1)); let mn = 1, mx = -1;
    for (let i = a; i < b; i += step) { const v = d[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    x.fillRect(px, mid - mx * amp, 1, Math.max(1, (mx - mn) * amp));
  }
  if (S.cursor != null) { const px = ((S.cursor - vs) / vd) * W; if (px >= 0 && px <= W) { x.fillStyle = 'rgba(255,255,255,.45)'; x.fillRect(Math.round(px), 0, 1, H); } }
  x.font = '700 10px ' + getComputedStyle(document.body).getPropertyValue('--mono');
  c.slices.forEach((t, i) => {
    const px = ((t - vs) / vd) * W; if (px < -20 || px > W + 2) return;
    const on = i === S.sel; x.fillStyle = on ? '#ffae3d' : 'rgba(233,235,241,.85)'; x.fillRect(Math.round(px) - 1, 0, 2, H);
    x.fillRect(Math.round(px) - 1, 0, 20, 15); x.fillStyle = '#12141a'; x.fillText(String(i + 1), Math.round(px) + 3, 11);
  });
}
function initWave() {
  const cv = $('wave'), px = e => e.clientX - cv.getBoundingClientRect().left, tAt = p => S.vs + (p / (cv._w || 1)) * S.vd;
  const hit = p => { const c = S.clip; if (!c) return -1; let best = -1, bd = 8; c.slices.forEach((t, i) => { const dx = Math.abs(((t - S.vs) / S.vd) * cv._w - p); if (dx <= bd) { bd = dx; best = i; } }); return best; };
  cv.addEventListener('contextmenu', e => { e.preventDefault(); const i = hit(px(e)); if (i >= 0) removeCut(i); });
  cv.addEventListener('pointerdown', e => {
    if (e.button === 2) return;
    if (!S.clip) { $('smpFile').click(); return; }
    const p = px(e), i = hit(p); S.cursor = tAt(p);
    if (i >= 0) { S.drag = { i, moved: false }; S.sel = i; cv.setPointerCapture(e.pointerId); updatePads(); drawWave(); return; }
    const c = S.clip; let k = 0; c.slices.forEach((t, j) => { if (t <= S.cursor) k = j; });
    S.sel = k; updatePads(); drawWave(); audition(k);
  });
  cv.addEventListener('pointermove', e => {
    if (!S.drag) return; const c = S.clip, i = S.drag.i, lo = i > 0 ? c.slices[i - 1] + 0.01 : 0, hi = i + 1 < c.slices.length ? c.slices[i + 1] - 0.01 : clipDur() - 0.02;
    c.slices[i] = clamp(tAt(px(e)), lo, Math.max(lo, hi)); S.drag.moved = true; drawWave();
  });
  const end = () => { const dr = S.drag; S.drag = null; if (dr && dr.moved) { const c = S.clip; c.slices[dr.i] = snapZero(c.slices[dr.i]); S.autoOn = false; cutsChanged(); audition(dr.i); } };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('dblclick', e => { if (S.clip) addCut(tAt(px(e))); });
  cv.addEventListener('wheel', e => {
    if (!S.clip) return;
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomBy(e.deltaY > 0 ? 1.25 : 0.8, px(e) / cv._w); }
    else if (S.vd < clipDur() - 1e-3) { e.preventDefault(); S.vs = clamp(S.vs + (e.deltaY + e.deltaX) * 0.002 * S.vd, 0, clipDur() - S.vd); panSync(); drawWave(); }
  }, { passive: false });
  $('smpPan').oninput = e => { const room = clipDur() - S.vd; S.vs = (e.target.value / 1000) * room; drawWave(); };
  if (window.ResizeObserver) new ResizeObserver(() => drawWave()).observe($('waveWrap'));
}

/* ---------- pads ---------- */
function buildPads() {
  const host = $('pads'); host.innerHTML = '';
  for (let row = 3; row >= 0; row--) for (let col = 0; col < 4; col++) {                  // pad 1 is bottom-left, like a drum machine
    const i = row * 4 + col, b = document.createElement('button'); b.className = 'pad'; b.dataset.i = i;
    b.innerHTML = '<span>' + (i + 1) + '</span><small></small>';
    b.addEventListener('pointerdown', e => { e.preventDefault(); if (!S.clip || i >= S.clip.slices.length) return; S.sel = i; updatePads(); drawWave(); audition(i); });
    b.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (S.clip && i < S.clip.slices.length) { S.sel = i; updatePads(); drawWave(); audition(i); } } });
    host.appendChild(b);
  }
}
function updatePads() {
  const n = S.clip ? S.clip.slices.length : 0;
  $('pads').querySelectorAll('.pad').forEach(b => {
    const i = +b.dataset.i, on = i < n; b.disabled = !on; b.classList.toggle('on', on && i === S.sel);
    b.querySelector('small').textContent = on ? (cutEnd(i) - S.clip.slices[i]).toFixed(2) + 's' : '';
    b.setAttribute('aria-label', 'Pad ' + (i + 1) + (on ? ', ' + (cutEnd(i) - S.clip.slices[i]).toFixed(2) + ' seconds' : ', empty'));
  });
}
function layOut() {
  const c = S.clip; if (!c) { toast('Import a clip first'); return; }
  const Ls = L(), D = clipDur(); snapshot();
  const ts = []; c.slices.forEach(t => { let s = Math.round((t / D) * Ls); if (ts.length && s <= ts[ts.length - 1]) s = ts[ts.length - 1] + 1; ts.push(s); });
  const ch = chOf('chops'); ch.notes = [];
  ts.forEach((t, i) => { if (t >= Ls) return; const nx = i + 1 < ts.length ? Math.min(ts[i + 1], Ls) : Ls; ch.notes.push({ id: _nid++, n: 36 + i, t, d: Math.max(1, nx - t), v: 0.9, s: false }); });
  selectCh('chops'); rackPaintAll(); rollRedraw(); saveSoon();
  toast('Laid ' + ch.notes.length + ' cuts across ' + P.bars + ' bar' + (P.bars > 1 ? 's' : '') + '. Edit them in the piano roll.');
}

/* ---------- instrument maker ---------- */
const zones = () => LIB.inst.zones;
const zoneBuf = (c, a, b) => (a == null ? c.buf : sliceCopy(c.buf, a, b));
function autoRange() {
  const zs = zones().slice().sort((p, q) => p.root - q.root);
  zs.forEach((z, i) => {
    z.lo = i === 0 ? 0 : Math.floor((zs[i - 1].root + z.root) / 2) + 1; z.hi = i === zs.length - 1 ? 127 : Math.floor((z.root + zs[i + 1].root) / 2);
    if (z.lo > z.hi) z.lo = z.hi = z.root;
  });
}
function addZone(whole) {
  const c = S.clip; if (!c) { toast('Import a clip first'); return; }
  if (zones().length >= MAXZONES) { toast('Zones are full (' + MAXZONES + ')'); return; }
  let a = null, b = null, nm = stem(c.name);
  if (!whole) { if (S.sel < 0) { toast('Select a cut first, or use Add whole clip'); return; } a = c.slices[S.sel]; b = cutEnd(S.sel); nm += ' cut ' + (S.sel + 1); }
  const buf = zoneBuf(c, a, b), pd = detectPitch(buf), root = pd && pd.conf > 0.7 ? Math.round(pd.midi) : 60;
  zones().push({ id: _zid++, clipId: c.id, name: nm, a, b, buf, root, lo: 0, hi: 127, loop: false, ls: 0, le: 0, gain: 1 });
  autoRange(); S.zi = zones().length - 1; renderZones(); libSaveSoon(); tryZone();
  if (!(pd && pd.conf > 0.7)) toast('No clear pitch heard, so the root is C4. Set the right note under Root.');
}
function tryZone() { const z = zones()[S.zi]; if (z) ensureEngine().then(en => en.preview(chOf('smp'), z.root)); }
function renderZones() {
  const el = $('zones'); el.innerHTML = '';
  if (!zones().length) { el.innerHTML = '<span class="hint">No zones yet. Select a cut above and press Add selected cut. Add several at different pitches to cover the keyboard.</span>'; }
  zones().forEach((z, i) => {
    const d = document.createElement('div'); d.className = 'zone' + (i === S.zi ? ' on' : ''); d.setAttribute('role', 'listitem');
    const b = document.createElement('button'); b.className = 'zsel'; b.textContent = z.name; b.title = z.name;
    const sp = document.createElement('small'); sp.textContent = midiName(z.root) + '  ' + midiName(z.lo) + '–' + midiName(z.hi) + (z.loop ? '  loop' : '');
    b.appendChild(sp); b.onclick = () => { S.zi = i; renderZones(); tryZone(); };
    const x = document.createElement('button'); x.className = 'zdel'; x.textContent = '✕'; x.setAttribute('aria-label', 'Remove zone ' + z.name);
    x.onclick = () => { zones().splice(i, 1); S.zi = Math.min(S.zi, zones().length - 1); autoRange(); renderZones(); libSaveSoon(); };
    d.append(b, x); el.appendChild(d);
  });
  syncZoneCtl();
}
function syncZoneCtl() {
  const z = zones()[S.zi], has = !!z;
  ['zRoot', 'zDetect', 'zLo', 'zHi', 'zLoop', 'zTry'].forEach(id => ($(id).disabled = !has));
  if (!has) { $('zLoop').setAttribute('aria-pressed', false); return; }
  $('zRoot').value = z.root; $('zLo').value = z.lo; $('zHi').value = z.hi; $('zLoop').setAttribute('aria-pressed', !!z.loop);
}
function initInst() {
  const fill = (id, lo, hi) => { const s = $(id); for (let m = lo; m <= hi; m++) s.add(new Option(midiName(m), m)); };
  fill('zRoot', 12, 108); fill('zLo', 0, 127); fill('zHi', 0, 127);
  $('instAddCut').onclick = () => addZone(false); $('instAddAll').onclick = () => addZone(true);
  $('instAuto').onclick = () => { autoRange(); renderZones(); libSaveSoon(); };
  $('instClr').onclick = () => { LIB.inst.zones = []; S.zi = -1; renderZones(); libSaveSoon(); };
  $('zRoot').onchange = e => { const z = zones()[S.zi]; if (!z) return; z.root = +e.target.value; autoRange(); renderZones(); libSaveSoon(); };
  $('zLo').onchange = e => { const z = zones()[S.zi]; if (!z) return; z.lo = +e.target.value; if (z.lo > z.hi) z.hi = z.lo; renderZones(); libSaveSoon(); };
  $('zHi').onchange = e => { const z = zones()[S.zi]; if (!z) return; z.hi = +e.target.value; if (z.hi < z.lo) z.lo = z.hi; renderZones(); libSaveSoon(); };
  $('zDetect').onclick = () => {
    const z = zones()[S.zi]; if (!z) return; const pd = detectPitch(z.buf);
    if (pd && pd.conf > 0.5) { z.root = clamp(Math.round(pd.midi), 12, 108); autoRange(); renderZones(); libSaveSoon(); toast('Heard ' + midiName(z.root) + (Math.abs(pd.midi - Math.round(pd.midi)) > 0.3 ? ' (a little out of tune)' : '')); }
    else toast('Could not hear a clear pitch. Drums and noise have none, so set the note by ear.');
  };
  $('zLoop').onclick = () => {
    const z = zones()[S.zi]; if (!z) return;
    if (z.loop) z.loop = false;
    else { const l = findLoop(z.buf); if (l) { z.ls = l.ls; z.le = l.le; z.loop = true; } else toast('No clean loop point in this sample. It needs a steady, held tone at least 0.3 s long.'); }
    renderZones(); libSaveSoon(); if (z.loop) tryZone();
  };
  $('zTry').onclick = tryZone;
  smpK.att = Knob($('kAtt'), { min: 0.002, max: 0.4, val: LIB.inst.attack, def: 0.005, label: 'Attack', fmt: v => Math.round(v * 1000) + ' ms', onInput: v => { LIB.inst.attack = v; libSaveSoon(); } });
  smpK.rel = Knob($('kRel'), { min: 0.03, max: 1.5, val: LIB.inst.release, def: 0.3, label: 'Release', fmt: v => Math.round(v * 1000) + ' ms', onInput: v => { LIB.inst.release = v; libSaveSoon(); } });
  renderZones();
}

/* ---------- drum override ---------- */
function drumCh(name) { return P.channels.find(d => d.type === 'drum' && d.drum === name); }
function oneShot(buf, a, b) {
  const s = sliceCopy(buf, a, Math.min(b, a + 3)), sr = s.sampleRate, fi = Math.floor(0.001 * sr), fo = Math.min(s.length >> 1, Math.floor(0.008 * sr));
  for (let ch = 0; ch < s.numberOfChannels; ch++) { const d = s.getChannelData(ch); for (let i = 0; i < fi; i++) d[i] *= i / fi; for (let i = 0; i < fo; i++) d[d.length - 1 - i] *= i / fo; }
  return normalize(s, 0.9);
}
async function applyDrum(name, clip, a, b, quiet) {
  await drumsReady;
  if (!SLIB.origDrums[name]) SLIB.origDrums[name] = drumBufs[name];
  drumBufs[name] = [oneShot(clip.buf, a, b)]; SLIB.drums[name] = { clipId: clip.id, a, b };
  renderDrums(); libSaveSoon();
  if (!quiet) { const d = drumCh(name); if (d) ensureEngine().then(en => en.preview(d, 0)); }
}
function resetDrum(name, quiet) {
  if (SLIB.origDrums[name] && drumBufs) drumBufs[name] = SLIB.origDrums[name];
  delete SLIB.drums[name]; renderDrums(); libSaveSoon(); if (!quiet) { const d = drumCh(name); if (d) ensureEngine().then(en => en.preview(d, 0)); }
}
function renderDrums() {
  const names = Object.keys(SLIB.drums).map(k => { const d = drumCh(k), c = SLIB.clips.find(x => x.id === SLIB.drums[k].clipId); return (d ? d.name : k) + ' ← ' + (c ? stem(c.name) : '?'); });
  $('drmList').textContent = names.length ? 'Using your sound: ' + names.join(', ') : '';
}
function initDrums() {
  const s = $('drmSel'); P.channels.filter(d => d.type === 'drum').forEach(d => s.add(new Option(d.name, d.drum)));
  $('drmCut').onclick = () => { const c = S.clip; if (!c || S.sel < 0) { toast('Select a cut first'); return; } applyDrum(s.value, c, c.slices[S.sel], cutEnd(S.sel)); };
  $('drmClip').onclick = () => { const c = S.clip; if (!c) { toast('Import a clip first'); return; } applyDrum(s.value, c, 0, c.buf.duration); };
  $('drmReset').onclick = () => resetDrum(s.value);
}

/* ---------- panel wiring ---------- */
function renderClips() {
  const s = $('smpClip'); s.innerHTML = '';
  SLIB.clips.forEach(c => s.add(new Option(stem(c.name), c.id)));
  if (!SLIB.clips.length) s.add(new Option('No clips yet', ''));
  s.value = S.clip ? S.clip.id : ''; s.disabled = !SLIB.clips.length;
  ['smpDel', 'smpPlay', 'smpAuto', 'smpHere', 'smpCut', 'smpClr', 'zOut', 'zIn', 'zFit', 'instAddCut', 'instAddAll', 'smpLay', 'drmCut', 'drmClip'].forEach(id => ($(id).disabled = !S.clip));
  $('smpEven').querySelectorAll('button').forEach(b => (b.disabled = !S.clip));
  updateInfo();
}
function updateInfo() { $('smpInfo').textContent = S.clip ? clipDur().toFixed(2) + ' s · ' + S.clip.slices.length + ' cut' + (S.clip.slices.length === 1 ? '' : 's') : ''; }
function setTab(t) {
  const m = t === 'mixer'; $('mixer').hidden = !m; $('sampler').hidden = m;
  $('tabMixer').setAttribute('aria-selected', m); $('tabSampler').setAttribute('aria-selected', !m);
  if (!m) requestAnimationFrame(drawWave);
}
function syncOpts() {
  $('smpRev').setAttribute('aria-pressed', S.opt.reverse); $('smpGate').setAttribute('aria-pressed', S.opt.gate);
  smpK.pitch.set(S.opt.pitch); $('pitchOut').textContent = (S.opt.pitch > 0 ? '+' : '') + S.opt.pitch + ' st'; smpK.sens.set(S.sens);
}
function initSampler() {
  $('sampler').innerHTML = SMP_HTML;
  $('tabMixer').onclick = () => setTab('mixer'); $('tabSampler').onclick = () => setTab('sampler');
  smpK.sens = Knob($('kSens'), { min: 0, max: 1, val: S.sens, def: 0.55, label: 'Sensitivity', fmt: v => Math.round(v * 100) + '%', onInput: v => { S.sens = v; clearTimeout(S.sT); S.sT = setTimeout(() => { if (S.clip && S.autoOn) autoChop(true); }, 120); } });
  smpK.pitch = Knob($('kPitch'), { min: -12, max: 12, val: 0, def: 0, label: 'Pitch (semitones)', fmt: v => Math.round(v) + ' st', onInput: v => {
    const r = Math.round(v); if (r === S.opt.pitch) return; S.opt.pitch = r; $('pitchOut').textContent = (r > 0 ? '+' : '') + r + ' st'; applyChop(); libSaveSoon(); } });
  buildPads(); initWave(); initInst(); initDrums();
  $('smpFile').onchange = e => { addFiles(e.target.files); e.target.value = ''; };
  $('smpClip').onchange = e => selectClip(e.target.value);
  $('smpDel').onclick = removeClip; $('smpPlay').onclick = playRaw;
  $('smpAuto').onclick = () => autoChop(false);
  $('smpEven').onclick = e => { const b = e.target.closest('button'); if (b && !b.disabled) evenChop(+b.dataset.n); };
  $('smpHere').onclick = () => { if (S.cursor == null) toast('Click the waveform where you want the cut, then press Cut here'); else addCut(S.cursor); };
  $('smpCut').onclick = () => removeCut(S.sel);
  $('smpClr').onclick = () => { const c = S.clip; if (!c) return; c.slices = [c.slices[0] || 0]; S.sel = 0; S.autoOn = false; cutsChanged(); };
  $('smpRev').onclick = () => { S.opt.reverse = !S.opt.reverse; $('smpRev').setAttribute('aria-pressed', S.opt.reverse); applyChop(); libSaveSoon(); };
  $('smpGate').onclick = () => { S.opt.gate = !S.opt.gate; $('smpGate').setAttribute('aria-pressed', S.opt.gate); applyChop(); libSaveSoon(); };
  $('zIn').onclick = () => zoomBy(0.5); $('zOut').onclick = () => zoomBy(2); $('zFit').onclick = () => { fitView(); drawWave(); };
  $('smpLay').onclick = layOut;
  // drag a file anywhere onto the page
  const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  window.addEventListener('dragover', e => { if (hasFiles(e)) { e.preventDefault(); $('sampler').classList.add('drag'); } });
  window.addEventListener('dragleave', e => { if (!e.relatedTarget) $('sampler').classList.remove('drag'); });
  window.addEventListener('drop', e => { if (!hasFiles(e)) return; e.preventDefault(); $('sampler').classList.remove('drag'); addFiles(e.dataTransfer.files); });
  renderClips(); updatePads(); renderDrums();
}

/* ---------- restore the saved library (IndexedDB) ---------- */
async function restoreLib() {
  await libInit(); if (!SLIB.db) return;
  let rows = [], meta = [];
  try { rows = await idbAll('clips'); meta = await idbAll('meta'); } catch (e) { return; }
  for (const r of rows) {
    try { const c = await makeClipObj(r.id, r.name, r.bytes); c.slices = r.slices && r.slices.length ? r.slices : detectOnsets(c.buf, S.sens, MAXPADS); SLIB.clips.push(c); } catch (e) {}
  }
  const st = meta.find(m => m.k === 'state');
  if (st) {
    S.opt = { pitch: st.pitch || 0, reverse: !!st.reverse, gate: !!st.gate };
    LIB.inst.attack = st.attack || LIB.inst.attack; LIB.inst.release = st.release || LIB.inst.release; smpK.att.set(LIB.inst.attack); smpK.rel.set(LIB.inst.release);
    LIB.inst.zones = (st.zones || []).map(z => { const c = SLIB.clips.find(x => x.id === z.clipId); return c ? { ...z, id: _zid++, buf: zoneBuf(c, z.a, z.b) } : null; }).filter(Boolean);
    S.zi = LIB.inst.zones.length ? 0 : -1;
    for (const [name, v] of Object.entries(st.drums || {})) { const c = SLIB.clips.find(x => x.id === v.clipId); if (c) await applyDrum(name, c, v.a, v.b, true); }
  }
  syncOpts(); renderZones();
  const pick = st && SLIB.clips.find(c => c.id === st.clip) || SLIB.clips[0];
  selectClip(pick ? pick.id : null);
}

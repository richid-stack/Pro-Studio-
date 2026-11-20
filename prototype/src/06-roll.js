/* ===== Piano roll: canvas editor with scale lock, slides, velocity lane ===== */
const R = { pps: 24, rowH: 16, top: 96, lo: 24, keyW: 56, snap: 1, sel: new Set(), drag: null, ghost: true, lastLen: 1, ch: null, zoomed: false, bg: null, k: {} };
const ROWS = R.top - R.lo + 1, BLACK = [1, 3, 6, 8, 10];
const isBlack = m => BLACK.includes(((m % 12) + 12) % 12);
const padN = () => (LIB.chop ? LIB.chop.slices.length : 0);
const isChop = () => R.ch && R.ch.inst === 'chop';
const inScale = m => (isChop() ? m >= 36 && m < 36 + Math.max(1, padN()) : SCALES[P.scale].includes((((m - P.key) % 12) + 12) % 12));
const dpr = () => Math.min(2, window.devicePixelRatio || 1);
const stepAt = x => x / R.pps, midiAt = y => R.top - Math.floor(y / R.rowH);
const snapFloor = v => Math.floor(v / R.snap + 1e-6) * R.snap, snapRound = v => Math.round(v / R.snap) * R.snap;
function lockMidi(m) {
  if (isChop()) return clamp(m, 36, 36 + Math.max(1, padN()) - 1);      // chop notes are pads, not pitches
  if (!P.lock) return m; const sc = SCALES[P.scale];
  for (let d = 0; d <= 6; d++) for (const s of [m - d, m + d]) if (sc.includes((((s - P.key) % 12) + 12) % 12)) return s;
  return m;
}
function fitCv(cv, w, h) { const r = dpr(); cv.width = Math.ceil(w * r); cv.height = Math.ceil(h * r); cv.style.width = w + 'px'; cv.style.height = h + 'px'; const x = cv.getContext('2d'); x.setTransform(r, 0, 0, r, 0, 0); return x; }
function rr(x, X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }

function rollAutoFit() {
  if (R.zoomed) return;
  const w = $('rollScroll').clientWidth - R.keyW - 8;
  R.pps = clamp(Math.floor(w / L()), 12, 44);
}
function rollLayout() {
  rollAutoFit();
  const W = L() * R.pps, H = ROWS * R.rowH;
  fitCv($('keysCv'), R.keyW, H); fitCv($('gridCv'), W, H);
  fitCv($('rlane'), W, 70);
  R.bg = document.createElement('canvas'); const bx = fitCv(R.bg, W, H); buildBg(bx, W, H);
  rollRedraw();
}
function buildBg(x, W, H) {
  for (let r = 0; r < ROWS; r++) {
    const m = R.top - r, y = r * R.rowH, bk = isBlack(m), sc = inScale(m), root = ((m - P.key) % 12 + 12) % 12 === 0;
    x.fillStyle = root ? '#202a3f' : sc ? (bk ? '#182033' : '#1b2336') : (bk ? '#10131a' : '#141820'); x.fillRect(0, y, W, R.rowH);
    x.fillStyle = m % 12 === 0 ? '#3a4356' : 'rgba(255,255,255,.035)'; x.fillRect(0, y + R.rowH - 1, W, 1);
  }
  for (let s = 0; s <= L() + 1e-6; s += R.snap) {
    const px = Math.round(s * R.pps) + .5, whole = Math.abs(s - Math.round(s)) < 1e-6, i = Math.round(s);
    x.fillStyle = !whole ? 'rgba(255,255,255,.035)' : i % 16 === 0 ? 'rgba(255,255,255,.22)' : i % 4 === 0 ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.05)';
    x.fillRect(px, 0, 1, H);
  }
}
function rollRedraw() {
  if (!R.ch || !R.bg) return;
  drawKeys(); drawGrid(); drawRLane(); drawThumb(R.ch);
  $('btnSlide').setAttribute('aria-pressed', R.sel.size > 0 && [...R.sel].every(id => (R.ch.notes.find(n => n.id === id) || {}).s));
}
function drawKeys() {
  const cv = $('keysCv'), x = cv.getContext('2d'), W = R.keyW, H = ROWS * R.rowH;
  x.clearRect(0, 0, W, H); x.font = '600 9px ' + getComputedStyle(document.body).getPropertyValue('--mono'); x.textBaseline = 'middle';
  for (let r = 0; r < ROWS; r++) {
    const m = R.top - r, y = r * R.rowH, bk = isBlack(m);
    x.fillStyle = '#d5d9e2'; x.fillRect(0, y, W, R.rowH);
    x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, y + R.rowH - 1, W, 1);
    if (bk) { x.fillStyle = '#171a21'; x.fillRect(0, y + 1, W * 0.62, R.rowH - 2); }
    if (inScale(m)) { x.fillStyle = R.ch.color; x.beginPath(); x.arc(W - 7, y + R.rowH / 2, 2.6, 0, 7); x.fill(); }
    if (isChop() && m >= 36 && m < 52) { x.fillStyle = '#2a3040'; x.fillText('Pad ' + (m - 35), W - 44, y + R.rowH / 2 + .5); }
    else if (m % 12 === 0) { x.fillStyle = '#2a3040'; x.fillText(midiName(m), W - 34, y + R.rowH / 2 + .5); }
  }
  x.fillStyle = '#0c0e12'; x.fillRect(W - 1, 0, 1, H);
}
function drawGrid() {
  const cv = $('gridCv'), x = cv.getContext('2d'), W = L() * R.pps, H = ROWS * R.rowH;
  x.clearRect(0, 0, W, H); x.drawImage(R.bg, 0, 0, W, H);
  if (R.ghost) for (const d of P.channels) {
    if (d.type !== 'inst' || d === R.ch) continue;
    x.strokeStyle = d.color; x.globalAlpha = 0.3; x.lineWidth = 1;
    for (const n of d.notes) { if (n.t >= L()) continue; const Y = (R.top - n.n) * R.rowH; if (Y < 0 || Y > H) continue; x.strokeRect(n.t * R.pps + .5, Y + 2.5, Math.max(3, n.d * R.pps - 2), R.rowH - 5); }
  }
  x.globalAlpha = 1;
  x.font = '600 9px ' + getComputedStyle(document.body).getPropertyValue('--mono'); x.textBaseline = 'middle';
  for (const n of R.ch.notes) {
    if (n.t >= L()) continue;
    const X = n.t * R.pps + 1, Y = (R.top - n.n) * R.rowH + 1, w = Math.max(4, n.d * R.pps - 2), h = R.rowH - 2, on = R.sel.has(n.id);
    x.globalAlpha = 0.5 + 0.5 * n.v; x.fillStyle = R.ch.color; rr(x, X, Y, w, h, 3); x.fill(); x.globalAlpha = 1;
    x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(X + 2, Y + 1, Math.max(0, w - 4), 1.5);
    if (on) { x.strokeStyle = '#fff'; x.lineWidth = 1.5; rr(x, X, Y, w, h, 3); x.stroke(); }
    if (n.s) { x.fillStyle = 'rgba(0,0,0,.55)'; x.beginPath(); x.moveTo(X, Y + h); x.lineTo(X + Math.min(w, 11), Y + h); x.lineTo(X, Y + 3); x.closePath(); x.fill(); }
    if (w > 30) { x.fillStyle = 'rgba(10,12,18,.78)'; x.fillText((n.s ? '↘ ' : '') + (isChop() ? 'Pad ' + (n.n - 35) : midiName(n.n)), X + (n.s ? 13 : 5), Y + h / 2 + .5); }
  }
}
function drawRLane() {
  const cv = $('rlane'), x = cv.getContext('2d'), W = L() * R.pps, H = 70;
  x.clearRect(0, 0, W, H);
  for (let s = 0; s < L(); s += 4) { x.fillStyle = (s >> 2) & 1 ? 'rgba(255,255,255,.02)' : 'rgba(255,255,255,.045)'; x.fillRect(s * R.pps, 0, 4 * R.pps, H); }
  for (const n of R.ch.notes) {
    if (n.t >= L()) continue; const h = n.v * (H - 10), X = n.t * R.pps;
    x.fillStyle = R.sel.has(n.id) ? '#fff' : R.ch.color; x.globalAlpha = 0.9; x.fillRect(X, H - h - 2, 5, h);
    x.globalAlpha = 1; x.fillRect(X - 1, H - h - 3, 7, 2);
  }
}

/* ---- channel switch ---- */
function rollSetChannel() {
  R.ch = chOf(sel.inst); R.sel.clear();
  $('rollChip').style.setProperty('--c', R.ch.color); $('rollChip').lastElementChild.textContent = R.ch.name;
  $('k808').hidden = R.ch.inst !== 'sub';
  if (!R.bg) { rollLayout(); } else { buildBg(R.bg.getContext('2d'), L() * R.pps, ROWS * R.rowH); }
  rollRedraw();
  const mids = R.ch.notes.map(n => n.n).sort((a, b) => a - b), mid = mids.length ? mids[mids.length >> 1] : (R.ch.inst === 'sub' ? 32 : R.ch.inst === 'chop' ? 42 : 66);
  const sc = $('rollScroll'); sc.scrollTop = Math.max(0, (R.top - mid) * R.rowH - sc.clientHeight / 2);
}
function bgRebuild() { if (R.bg) { R.bg.getContext('2d').clearRect(0, 0, 1e5, 1e5); buildBg(R.bg.getContext('2d'), L() * R.pps, ROWS * R.rowH); rollRedraw(); } }

/* ---- editing ---- */
function removeNote(n) { R.ch.notes.splice(R.ch.notes.indexOf(n), 1); R.sel.delete(n.id); }
function hitNote(x, y) {
  const s = stepAt(x), m = midiAt(y), ml = lockMidi(m);      // with scale lock a click on an out-of-scale row lands on its in-scale neighbour
  for (let i = R.ch.notes.length - 1; i >= 0; i--) { const n = R.ch.notes[i]; if ((n.n === m || n.n === ml) && s >= n.t && s <= n.t + n.d) return n; }
  return null;
}
function preview(m) { ensureEngine().then(en => en.preview(R.ch, m)); }
function selectedNotes() { return R.ch.notes.filter(n => R.sel.has(n.id)); }
function initRoll() {
  const g = $('gridCv'), rect = () => g.getBoundingClientRect();
  g.addEventListener('contextmenu', e => e.preventDefault());
  g.addEventListener('pointerdown', e => {
    e.preventDefault(); g.setPointerCapture(e.pointerId); ensureEngine();
    const r = rect(), x = e.clientX - r.left, y = e.clientY - r.top, n = hitNote(x, y);
    if (e.button === 2) { if (n) { snapshot(); removeNote(n); rollRedraw(); saveSoon(); } return; }
    snapshot();
    if (n) {
      if (e.shiftKey && R.sel.has(n.id)) { R.sel.delete(n.id); rollRedraw(); return; }
      if (!e.shiftKey && !R.sel.has(n.id)) R.sel.clear();
      R.sel.add(n.id);
      if (Math.abs(x - (n.t + n.d) * R.pps) < 8 && n.d * R.pps > 14) R.drag = { mode: 'resize', n };
      else R.drag = { mode: 'move', n, grab: stepAt(x) - n.t, orig: new Map(selectedNotes().map(q => [q.id, { t: q.t, n: q.n }])), pm: n.n };
      preview(n.n);
    } else {
      R.sel.clear(); const m = lockMidi(midiAt(y)); if (m < R.lo || m > R.top) return;
      const nn = { id: _nid++, t: clamp(snapFloor(stepAt(x)), 0, L() - R.snap), d: Math.min(Math.max(R.lastLen, R.snap), L()), n: m, v: 0.85, s: false };
      R.ch.notes.push(nn); R.sel.add(nn.id); R.drag = { mode: 'resize', n: nn }; preview(m);
    }
    rollRedraw();
  });
  g.addEventListener('pointermove', e => {
    const r = rect(), x = e.clientX - r.left, y = e.clientY - r.top, dr = R.drag;
    if (!dr) { const n = hitNote(x, y); g.style.cursor = n ? (Math.abs(x - (n.t + n.d) * R.pps) < 8 ? 'ew-resize' : 'grab') : 'crosshair'; return; }
    if (dr.mode === 'resize') dr.n.d = clamp(Math.max(R.snap, snapRound(stepAt(x) - dr.n.t)), R.snap, L() - dr.n.t);
    else {
      const p = dr.orig.get(dr.n.id), dT = snapRound(stepAt(x) - dr.grab) - p.t, tm = lockMidi(midiAt(y)), dM = tm - p.n;
      for (const q of selectedNotes()) { const o = dr.orig.get(q.id); if (!o) continue; q.t = clamp(o.t + dT, 0, L() - q.d); q.n = clamp(o.n + dM, R.lo, R.top); }
      if (dr.n.n !== dr.pm) { dr.pm = dr.n.n; preview(dr.n.n); }
    }
    rollRedraw();
  });
  const end = () => {
    if (!R.drag) return;
    if (R.drag.mode === 'resize') R.lastLen = R.drag.n.d;
    R.drag = null; rollRedraw(); saveSoon();
  };
  g.addEventListener('pointerup', end); g.addEventListener('pointercancel', end);
  $('keysCv').addEventListener('pointerdown', e => { const r = $('keysCv').getBoundingClientRect(); const m = midiAt(e.clientY - r.top); if (m >= R.lo && m <= R.top) preview(m); });
  $('rollScroll').addEventListener('scroll', () => { $('rlS').scrollLeft = $('rollScroll').scrollLeft; });
  $('rollScroll').addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault();
    R.zoomed = true; R.pps = clamp(R.pps * (e.deltaY < 0 ? 1.12 : 0.89), 10, 64); rollLayout();
  }, { passive: false });
  // velocity lane: drag on a note's bar (chords share a start, so they move together)
  const rl = $('rlane'); let on = false;
  const setV = e => {
    const r = rl.getBoundingClientRect(), x = e.clientX - r.left, v = clamp(1 - (e.clientY - r.top - 2) / 60, 0.05, 1);
    const hits = R.ch.notes.filter(n => Math.abs(n.t * R.pps + 2.5 - x) < 6);
    if (!hits.length) return; hits.forEach(n => (n.v = v)); rollRedraw();
  };
  rl.addEventListener('pointerdown', e => { on = true; rl.setPointerCapture(e.pointerId); snapshot(); setV(e); });
  rl.addEventListener('pointermove', e => { if (on) setV(e); });
  const rend = () => { if (on) { on = false; saveSoon(); } };
  rl.addEventListener('pointerup', rend); rl.addEventListener('pointercancel', rend);
  // toolbar
  $('snap').onchange = e => { R.snap = parseFloat(e.target.value); R.lastLen = Math.max(R.snap, 1); bgRebuild(); };
  $('btnGhost').onclick = () => { R.ghost = !R.ghost; $('btnGhost').setAttribute('aria-pressed', R.ghost); rollRedraw(); };
  $('btnSlide').onclick = toggleSlide; $('btnQuant').onclick = quantize;
  $('btnClear').onclick = () => { if (!R.ch.notes.length) return; snapshot(); R.ch.notes = []; R.sel.clear(); rollRedraw(); saveSoon(); };
  const c808 = (id, key, min, max, label) => (R.k[key] = Knob($(id), { min, max, val: P.p808[key], def: PRESETS[P.genre].p808[key], label, color: R.ch ? R.ch.color : '#c58cff', onInput: v => { P.p808[key] = v; if (eng) eng.p808 = P.p808; saveSoon(); } }));
  c808('kDecay', 'decay', 0.12, 2.4, '808 decay'); c808('kGlide', 'glide', 0.02, 0.35, 'Slide time'); c808('kDrive', 'drive', 0.5, 4, 'Saturation');
}
function toggleSlide() {
  const ns = selectedNotes(); if (!ns.length) return; snapshot();
  const on = !ns.every(n => n.s); ns.forEach(n => (n.s = on)); rollRedraw(); saveSoon();
}
function quantize() {
  const ns = R.sel.size ? selectedNotes() : R.ch.notes; if (!ns.length) return; snapshot();
  ns.forEach(n => { n.t = clamp(snapRound(n.t), 0, L() - R.snap); n.d = Math.max(R.snap, snapRound(n.d)); }); rollRedraw(); saveSoon();
}
function deleteSelected() { if (!R.sel.size) return; snapshot(); R.ch.notes = R.ch.notes.filter(n => !R.sel.has(n.id)); R.sel.clear(); rollRedraw(); saveSoon(); }
function syncKnobs808() { for (const k of ['decay', 'glide', 'drive']) R.k[k] && R.k[k].set(P.p808[k]); }

/* ===== Forge UI core: state, controls, history ===== */
const $ = id => document.getElementById(id);
const SAVE_KEY = 'forge.project.v3';
let P = null, eng = null, drumBufs = null;
const sel = { drum: 'hat', inst: 'bass' };
const ui = { tool: 'draw', lite: (() => {
  try { const s = localStorage.getItem('forge.lite'); if (s !== null) return s === '1'; } catch (e) {}
  return matchMedia('(pointer:coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4;     // phones and small CPUs start in Lite
})() };
const chOf = id => P.channels.find(d => d.id === id);
const L = () => P.bars * 16;

/* ---- undo + autosave ---- */
const hist = [];
function pat() { return JSON.stringify(P.channels.map(d => (d.type === 'drum' ? { v: d.v, r: d.r } : { n: d.notes }))); }
function snapshot() { hist.push(pat()); if (hist.length > 80) hist.shift(); }
function undo() {
  const s = hist.pop(); if (!s) return;
  JSON.parse(s).forEach((x, i) => { const d = P.channels[i]; if (d.type === 'drum') { d.v = x.v; d.r = x.r; } else d.notes = x.n; });
  R.sel.clear(); rackPaintAll(); rollRedraw(); saveSoon();
}
let saveT = 0;
function saveSoon() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(P)); } catch (e) {} }, 500);
}
function loadSaved() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s && s.channels && s.channels.length === CH_DEFS.length && s.p808) { s.channels.forEach(d => { if (d.notes) d.notes.forEach(n => { if (n.id >= _nid) _nid = n.id + 1; }); }); return s; }
  } catch (e) {}
  return null;
}

/* ---- knob: drag vertically, wheel, double-click resets ---- */
function Knob(host, o) {
  const { min = 0, max = 1, def = null, onInput, label = '', fmt } = o;
  let v = o.val ?? min, drag = null;
  host.classList.add('knob'); host.tabIndex = 0; host.setAttribute('role', 'slider');
  host.setAttribute('aria-label', label); host.setAttribute('aria-valuemin', min); host.setAttribute('aria-valuemax', max);
  if (o.color) host.style.setProperty('--c', o.color);
  const paint = () => {
    host.style.setProperty('--n', (v - min) / (max - min));
    host.setAttribute('aria-valuenow', v.toFixed(2));
    host.title = label + ': ' + (fmt ? fmt(v) : v.toFixed(2));
  };
  const set = x => { v = clamp(x, min, max); paint(); onInput && onInput(v); };
  host.addEventListener('pointerdown', e => { host.setPointerCapture(e.pointerId); drag = { y: e.clientY, v }; e.preventDefault(); host.focus(); });
  host.addEventListener('pointermove', e => { if (drag) set(drag.v + ((drag.y - e.clientY) / 150) * (max - min)); });
  const end = () => { drag = null; };
  host.addEventListener('pointerup', end); host.addEventListener('pointercancel', end);
  host.addEventListener('dblclick', () => { if (def != null) set(def); });
  host.addEventListener('wheel', e => { e.preventDefault(); set(v - Math.sign(e.deltaY) * (max - min) / 40); }, { passive: false });
  host.addEventListener('keydown', e => {
    const st = (max - min) / 40;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { set(v + st); e.preventDefault(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { set(v - st); e.preventDefault(); }
  });
  paint();
  return { set(x) { v = clamp(x, min, max); paint(); }, get: () => v };
}

/* ---- fader in dB, -inf .. +6 ---- */
function Fader(host, o) {
  host.innerHTML = '<div class="trk"></div><div class="zero"></div><div class="hdl"></div>';
  if (o.color) host.style.setProperty('--c', o.color);
  const hdl = host.querySelector('.hdl'), zero = host.querySelector('.zero'), trk = host.querySelector('.trk');
  host.setAttribute('role', 'slider'); host.tabIndex = 0; host.setAttribute('aria-label', o.label || 'Level');
  let db = o.val, drag = false;
  const nOf = x => (x <= -60 ? 0 : (x + 60) / 66), dbOf = n => (n <= 0.012 ? -60 : -60 + n * 66);
  const geo = () => { const h = host.clientHeight - 12; return { top: 6, h }; };
  const paint = () => {
    const g = geo(); hdl.style.bottom = (6 + nOf(db) * g.h) + 'px'; zero.style.bottom = (6 + nOf(0) * g.h) + 'px';
    host.setAttribute('aria-valuenow', db <= -60 ? '-inf' : db.toFixed(1)); o.onPaint && o.onPaint(db);
  };
  const fromY = y => { const r = host.getBoundingClientRect(), g = geo(); return dbOf(clamp(1 - (y - r.top - 6) / g.h, 0, 1)); };
  const set = x => { db = x; paint(); o.onInput && o.onInput(db); };
  host.addEventListener('pointerdown', e => { drag = true; host.setPointerCapture(e.pointerId); host.focus(); set(fromY(e.clientY)); e.preventDefault(); });
  host.addEventListener('pointermove', e => { if (drag) set(fromY(e.clientY)); });
  const end = () => { drag = false; };
  host.addEventListener('pointerup', end); host.addEventListener('pointercancel', end);
  host.addEventListener('dblclick', () => set(o.def ?? 0));
  host.addEventListener('wheel', e => { e.preventDefault(); set(clamp(db - Math.sign(e.deltaY) * 1, -60, 6)); }, { passive: false });
  host.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp') { set(clamp(db + 1, -60, 6)); e.preventDefault(); }
    if (e.key === 'ArrowDown') { set(clamp(db - 1, -60, 6)); e.preventDefault(); }
  });
  requestAnimationFrame(paint);
  return { set(x) { db = x; paint(); }, repaint: paint };
}
const fmtDb = db => (db <= -60 ? '-∞' : (db > 0 ? '+' : '') + db.toFixed(1));

/* ---- meters (rAF-driven) ---- */
function meterFeed(el, st, p) {
  const db = p > 0.00002 ? 20 * Math.log10(p) : -90, n = clamp((db + 60) / 60, 0, 1);
  st.lv = Math.max(n, (st.lv || 0) - 0.035);
  if (n >= (st.pk || 0)) { st.pk = n; st.hold = 28; } else if (st.hold-- <= 0) st.pk = Math.max(0, st.pk - 0.012);
  el.firstElementChild.style.transform = 'scaleY(' + st.lv.toFixed(3) + ')';
  el.lastElementChild.style.bottom = (st.pk * 100).toFixed(1) + '%';
}

/* ---- audio engine (needs a user gesture) ---- */
let engPromise = null;
function ensureEngine() {
  if (eng) { if (eng.ctx.state !== 'running') eng.ctx.resume(); return Promise.resolve(eng); }
  if (!engPromise) engPromise = (async () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' });
    try { await ctx.resume(); } catch (e) {}
    if (!drumBufs) drumBufs = await drumsReady;
    eng = new Engine(ctx, P, drumBufs, ui.lite);
    ctx.onstatechange = () => { if (ctx.state !== 'running') $('startNote').hidden = false, $('startNote').textContent = 'Audio paused. Tap anywhere to resume'; else $('startNote').hidden = true; };
    eng.setTempo(P.bpm); eng.setGlue(true); eng.setMaster(P.masterDb);
    $('startNote').hidden = true;
    return eng;
  })();
  return engPromise;
}

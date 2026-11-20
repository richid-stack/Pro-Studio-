/* ===== Channel rack: step grid, hi-hat rolls, velocity lane ===== */
const CELL = 20, ROLLS = [1, 2, 3, 4, 6, 8];
let cells = {}, thumbs = {};
let paintOp = null;

function buildRack() {
  const names = $('names'), inEl = $('stepsIn'), W = L() * CELL + 4;
  names.innerHTML = '<div class="corner"></div>'; inEl.innerHTML = '';
  const ruler = document.createElement('div'); ruler.className = 'ruler'; ruler.style.width = W + 'px';
  for (let i = 0; i < L(); i += 4) {
    const t = document.createElement('i'); t.style.left = (i * CELL + 3) + 'px';
    t.textContent = i % 16 === 0 ? String(i / 16 + 1) : String(((i / 4) % 4) + 1); if (i % 16 === 0) t.className = 'bar'; ruler.appendChild(t);
  }
  inEl.appendChild(ruler); cells = {}; thumbs = {};
  P.channels.forEach((d, idx) => {
    if (idx === 6) { names.appendChild(Object.assign(document.createElement('div'), { className: 'sep' })); inEl.appendChild(Object.assign(document.createElement('div'), { className: 'sep' })); }
    const nr = document.createElement('div'); nr.className = 'nrow'; nr.dataset.ch = d.id; nr.style.setProperty('--c', d.color);
    nr.innerHTML = '<span class="dot"></span><span class="nm"></span><button class="m" aria-label="Mute"></button>';
    nr.querySelector('.nm').textContent = d.name;
    const mb = nr.querySelector('.m'); mb.textContent = 'M'; mb.setAttribute('aria-pressed', d.mix.mute);
    mb.addEventListener('click', e => { e.stopPropagation(); d.mix.mute = !d.mix.mute; syncMixUI(); saveSoon(); });
    nr.addEventListener('pointerdown', e => { if (e.target === mb) return; selectCh(d.id); ensureEngine().then(en => en.preview(d, d.type === 'inst' ? (d.inst === 'sub' || d.inst === 'chop' ? 36 : 60) : 0)); });
    names.appendChild(nr);
    const sr = document.createElement('div'); sr.className = 'srow'; sr.dataset.ch = d.id; sr.style.setProperty('--c', d.color); sr.style.width = W + 'px';
    if (d.type === 'drum') {
      cells[d.id] = [];
      for (let i = 0; i < L(); i++) {
        const c = document.createElement('div'); c.className = 'cell' + ((i >> 2) & 1 ? ' g' : ''); c.dataset.ch = d.id; c.dataset.i = i;
        sr.appendChild(c); cells[d.id].push(c); paintStep(d, i);
      }
    } else {
      const cv = document.createElement('canvas'); cv.className = 'thumb'; cv.dataset.ch = d.id; cv.style.height = '30px';
      thumbs[d.id] = cv; sr.appendChild(cv); drawThumb(d);
    }
    inEl.appendChild(sr);
  });
  const ph = document.createElement('div'); ph.className = 'phead'; ph.id = 'phead'; inEl.appendChild(ph);
  refreshSel(); laneSize(); laneDraw();
}
function paintStep(d, i) {
  const c = cells[d.id] && cells[d.id][i]; if (!c) return;
  const v = d.v[i]; c.classList.toggle('on', v > 0); c.style.setProperty('--v', v);
  c.dataset.r = d.r[i] > 1 ? d.r[i] : '';
}
function rackPaintAll() {
  for (const d of P.channels) { if (d.type === 'drum') for (let i = 0; i < L(); i++) paintStep(d, i); else drawThumb(d); }
  laneDraw();
}
function drawThumb(d) {
  const cv = thumbs[d.id]; if (!cv) return;
  const w = L() * CELL, h = 30, dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px';
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
  for (let i = 0; i < L(); i += 4) { x.fillStyle = (i >> 2) & 1 ? 'rgba(255,255,255,.025)' : 'rgba(255,255,255,.055)'; x.fillRect(i * CELL, 3, 4 * CELL - 2, h - 6); }
  if (!d.notes.length) return;
  let lo = 999, hi = 0; for (const n of d.notes) { lo = Math.min(lo, n.n); hi = Math.max(hi, n.n); }
  const span = Math.max(12, hi - lo + 1);
  x.fillStyle = d.color;
  for (const n of d.notes) { if (n.t >= L()) continue; const y = 4 + (1 - (n.n - lo + 0.5) / span) * (h - 10); x.globalAlpha = 0.5 + 0.5 * n.v; x.fillRect(n.t * CELL, y, Math.max(2, n.d * CELL - 1), 3); }
  x.globalAlpha = 1;
}

/* ---- selection ---- */
function selectCh(id) {
  const d = chOf(id);
  if (d.type === 'drum') sel.drum = id; else { sel.inst = id; rollSetChannel(); }
  refreshSel(); laneDraw();
}
function refreshSel() {
  document.querySelectorAll('.nrow,.srow').forEach(el => el.classList.toggle('sel', el.dataset.ch === sel.drum || el.dataset.ch === sel.inst));
  const d = chOf(sel.drum); $('laneName').textContent = d.name + ' velocity'; $('rollShape').value = d.roll || 'flat';
}

/* ---- step painting ---- */
function audition(d) { ensureEngine().then(en => en.preview(d, 60)); }
function applyPaint(d, i) {
  if (paintOp.mode === 'draw') { if (!(d.v[i] > 0)) { d.v[i] = 0.8; paintStep(d, i); audition(d); } }
  else if (d.v[i] > 0) { d.v[i] = 0; d.r[i] = 1; paintStep(d, i); }
}
function cycleRoll(d, i) {
  if (!(d.v[i] > 0)) { d.v[i] = 0.8; d.r[i] = 2; } else d.r[i] = ROLLS[(ROLLS.indexOf(d.r[i]) + 1) % ROLLS.length] || 2;
  paintStep(d, i); laneDraw(); audition(d);
}
function initRackEvents() {
  const inEl = $('stepsIn');
  inEl.addEventListener('contextmenu', e => e.preventDefault());
  inEl.addEventListener('pointerdown', e => {
    const c = e.target.closest('.cell');
    if (!c) { const sr = e.target.closest('.srow'); if (sr) { selectCh(sr.dataset.ch); ensureEngine(); } return; }
    const d = chOf(c.dataset.ch), i = +c.dataset.i; selectCh(d.id); e.preventDefault(); snapshot();
    if (e.button === 2 || ui.tool === 'roll') { cycleRoll(d, i); saveSoon(); return; }
    paintOp = { d, mode: d.v[i] > 0 ? 'erase' : 'draw' }; applyPaint(d, i);
  });
  inEl.addEventListener('pointermove', e => {
    if (!paintOp) return;
    const el = document.elementFromPoint(e.clientX, e.clientY), c = el && el.closest && el.closest('.cell');
    if (c && c.dataset.ch === paintOp.d.id) applyPaint(paintOp.d, +c.dataset.i);
  });
  const up = () => { if (paintOp) { paintOp = null; laneDraw(); saveSoon(); } };
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  $('steps').addEventListener('scroll', () => { $('laneR').scrollLeft = $('steps').scrollLeft; });
  $('toolDraw').onclick = () => setTool('draw'); $('toolRoll').onclick = () => setTool('roll');
  $('rollShape').onchange = e => { chOf(sel.drum).roll = e.target.value; saveSoon(); };
  initLane();
}
function setTool(t) { ui.tool = t; $('toolDraw').setAttribute('aria-pressed', t === 'draw'); $('toolRoll').setAttribute('aria-pressed', t === 'roll'); }

/* ---- velocity lane ---- */
const LANE_H = 76;
function laneSize() {
  const cv = $('vlane'), w = L() * CELL + 4, dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = w * dpr; cv.height = LANE_H * dpr; cv.style.width = w + 'px'; cv.style.height = LANE_H + 'px';
}
function laneDraw() {
  const cv = $('vlane'), x = cv.getContext('2d'), w = L() * CELL + 4, dpr = Math.min(2, window.devicePixelRatio || 1), d = chOf(sel.drum);
  x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, LANE_H);
  for (let i = 0; i < L(); i += 4) { x.fillStyle = (i >> 2) & 1 ? 'rgba(255,255,255,.02)' : 'rgba(255,255,255,.045)'; x.fillRect(i * CELL + 2, 0, 4 * CELL, LANE_H); }
  x.strokeStyle = 'rgba(255,255,255,.07)'; x.lineWidth = 1;
  [0.25, 0.5, 0.75].forEach(f => { x.beginPath(); x.moveTo(0, LANE_H * f + .5); x.lineTo(w, LANE_H * f + .5); x.stroke(); });
  x.font = '700 9px ' + getComputedStyle(document.body).getPropertyValue('--mono');
  for (let i = 0; i < L(); i++) {
    const v = d.v[i]; if (!(v > 0)) continue;
    const h = v * (LANE_H - 16), px = i * CELL + 2;
    x.fillStyle = d.color; x.globalAlpha = 0.9; x.fillRect(px, LANE_H - h - 2, 18, h);
    x.globalAlpha = 1; x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(px, LANE_H - h - 2, 18, 2);
    if (d.r[i] > 1) { x.fillStyle = '#fff'; x.fillText('×' + d.r[i], px + 1, LANE_H - h - 6); }
  }
}
function initLane() {
  const cv = $('vlane'); let on = false;
  const set = e => {
    const r = cv.getBoundingClientRect(), d = chOf(sel.drum), i = Math.floor((e.clientX - r.left - 2) / CELL);
    if (i < 0 || i >= L() || !(d.v[i] > 0)) return;
    d.v[i] = clamp(1 - (e.clientY - r.top - 2) / (LANE_H - 16), 0.06, 1); paintStep(d, i); laneDraw();
  };
  cv.addEventListener('pointerdown', e => { on = true; cv.setPointerCapture(e.pointerId); snapshot(); set(e); });
  cv.addEventListener('pointermove', e => { if (on) set(e); });
  const end = () => { if (on) { on = false; saveSoon(); } };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
}

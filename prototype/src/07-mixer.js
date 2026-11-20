/* ===== Mixer: channel strips + master ===== */
let strips = {}, masterUI = null;

function buildMixer() {
  const mx = $('mixer'); mx.innerHTML = ''; strips = {};
  P.channels.forEach(d => {
    const s = document.createElement('div'); s.className = 'strip'; s.style.setProperty('--c', d.color);
    s.innerHTML = '<div class="s-name"></div><div class="s-knobs"><label>Pan<div class="kp"></div></label><label>Rev<div class="kr"></div></label><label>Dly<div class="kd"></div></label><label class="dk">Duck<div class="kk"></div></label></div>' +
      '<div class="s-fw"><div class="meter"><i></i><b></b></div><div class="fader"></div></div><div class="s-db"></div><div class="s-btns"><button class="bm" aria-label="Mute">M</button><button class="bs" aria-label="Solo">S</button></div>';
    s.querySelector('.s-name').textContent = d.name; s.querySelector('.s-name').title = d.name;
    const upd = () => { if (eng) eng.syncMix(); saveSoon(); };
    const kn = (sel, key, min, max, def, label) => Knob(s.querySelector(sel), { min, max, def, val: d.mix[key], label: d.name + ' ' + label, color: d.color, onInput: v => { d.mix[key] = v; upd(); } });
    kn('.kp', 'pan', -1, 1, 0, 'pan'); kn('.kr', 'rev', 0, 1, 0, 'reverb send'); kn('.kd', 'dly', 0, 1, 0, 'delay send');
    if (d.type === 'inst') kn('.kk', 'duck', 0, 1, 0, 'kick sidechain'); else s.querySelector('.dk').classList.add('off');
    s.querySelectorAll('.s-knobs .knob').forEach(k => k.classList.add('sm'));
    const dbEl = s.querySelector('.s-db');
    const fd = Fader(s.querySelector('.fader'), { val: d.mix.db, def: 0, color: d.color, label: d.name + ' level', onPaint: db => (dbEl.textContent = fmtDb(db)), onInput: db => { d.mix.db = db; upd(); } });
    const bm = s.querySelector('.bm'), bs = s.querySelector('.bs');
    bm.onclick = () => { d.mix.mute = !d.mix.mute; syncMixUI(); saveSoon(); };
    bs.onclick = () => { d.mix.solo = !d.mix.solo; syncMixUI(); saveSoon(); };
    mx.appendChild(s);
    strips[d.id] = { el: s, bm, bs, fd, meter: s.querySelector('.meter'), st: {} };
  });
  // master
  const m = document.createElement('div'); m.className = 'strip master'; m.style.setProperty('--c', '#e9ebf1');
  m.innerHTML = '<div class="s-name">Master</div><button class="tb" id="glue" aria-pressed="true" title="Bus compressor">Glue</button><div class="gr" id="gr">GR 0.0</div>' +
    '<div class="s-fw"><div class="meter" id="msL"><i></i><b></b></div><div class="meter" id="msR"><i></i><b></b></div><div class="fader" id="mfader"></div></div><div class="s-db" id="mdb"></div><div class="gr">limiter -4 dB</div>';
  mx.appendChild(m);
  const mdb = m.querySelector('#mdb');
  const fd = Fader(m.querySelector('#mfader'), { val: P.masterDb, def: 0, color: '#e9ebf1', label: 'Master level', onPaint: db => (mdb.textContent = fmtDb(db)), onInput: db => { P.masterDb = db; if (eng) eng.setMaster(db); saveSoon(); } });
  const glue = m.querySelector('#glue');
  glue.onclick = () => { const on = glue.getAttribute('aria-pressed') !== 'true'; glue.setAttribute('aria-pressed', on); if (eng) eng.setGlue(on); };
  masterUI = { fd, gr: m.querySelector('#gr'), L: m.querySelector('#msL'), R: m.querySelector('#msR'), stL: {}, stR: {} };
  syncMixUI();
}
function syncMixUI() {
  for (const d of P.channels) {
    const s = strips[d.id]; if (s) { s.bm.setAttribute('aria-pressed', d.mix.mute); s.bs.setAttribute('aria-pressed', d.mix.solo); }
    const nm = document.querySelector('.nrow[data-ch="' + d.id + '"] .m'); if (nm) nm.setAttribute('aria-pressed', d.mix.mute);
  }
  if (eng) eng.syncMix();
}

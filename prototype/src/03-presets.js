/* ===== Forge project model + genre starters ===== */
const MAXSTEPS = 64;
let _nid = 1;
const N = name => {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  return { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12;
};
const M = x => (typeof x === 'string' ? N(x) : x);
const nt = (t, d, n, v = 0.85, s = false) => ({ id: _nid++, t, d, n: M(n), v, s });
const chord = (t, d, ns, v = 0.8) => ns.map(n => nt(t, d, n, v));

function row(str) {
  const s = str.replace(/[\s|]/g, ''), v = new Array(MAXSTEPS).fill(0), r = new Array(MAXSTEPS).fill(1);
  for (let i = 0; i < Math.min(s.length, MAXSTEPS); i++) {
    const ch = s[i];
    if (ch === 'X') v[i] = 1; else if (ch === 'x') v[i] = 0.8; else if (ch === 'o') v[i] = 0.45;
    else if (/[2-8]/.test(ch)) { v[i] = 0.8; r[i] = +ch; }
  }
  return { v, r };
}

const CH_DEFS = [
  { id:'kick',  name:'Kick',     type:'drum', drum:'kick',  color:'#ff6b57', roll:'flat', mix:{ db:-3,  pan:0,    rev:0,    dly:0,    duck:0,   mute:false, solo:false } },
  { id:'snare', name:'Snare',    type:'drum', drum:'snare', color:'#ffb23f', roll:'flat', mix:{ db:-5,  pan:0,    rev:0.14, dly:0,    duck:0,   mute:false, solo:false } },
  { id:'clap',  name:'Clap',     type:'drum', drum:'clap',  color:'#ffd84d', roll:'flat', mix:{ db:-7,  pan:0.05, rev:0.24, dly:0,    duck:0,   mute:false, solo:false } },
  { id:'hat',   name:'Hi-Hat',   type:'drum', drum:'hat',   color:'#6fe0b0', roll:'up',   mix:{ db:-11, pan:0.12, rev:0.05, dly:0,    duck:0,   mute:false, solo:false } },
  { id:'ohat',  name:'Open Hat', type:'drum', drum:'ohat',  color:'#3fd0d0', roll:'flat', mix:{ db:-13, pan:-0.14,rev:0.12, dly:0,    duck:0,   mute:false, solo:false } },
  { id:'perc',  name:'Rim',      type:'drum', drum:'rim',   color:'#7fb2ff', roll:'flat', mix:{ db:-11, pan:-0.22,rev:0.18, dly:0.08, duck:0,   mute:false, solo:false } },
  { id:'bass',  name:'808',      type:'inst', inst:'sub',    color:'#c58cff', mix:{ db:-4,  pan:0,    rev:0,    dly:0,    duck:0.4, mute:false, solo:false } },
  { id:'keys',  name:'Rhodes',   type:'inst', inst:'rhodes', color:'#ff8fc4', mix:{ db:-9,  pan:-0.1, rev:0.25, dly:0.05, duck:0.3, mute:false, solo:false } },
  { id:'pluck', name:'Guitar',   type:'inst', inst:'pluck',  color:'#f3a15d', mix:{ db:-8,  pan:0.22, rev:0.2,  dly:0.15, duck:0.15,mute:false, solo:false } },
  { id:'pad',   name:'Pad',      type:'inst', inst:'pad',    color:'#79a8ff', mix:{ db:-16, pan:0,    rev:0.45, dly:0,    duck:0.5, mute:false, solo:false } },
  { id:'organ', name:'Organ',    type:'inst', inst:'organ',  color:'#e4dd6a', mix:{ db:-15, pan:-0.2, rev:0.2,  dly:0,    duck:0.25,mute:false, solo:false } },
  { id:'chops', name:'Chops',    type:'inst', inst:'chop',    color:'#58d0ff', mix:{ db:-6,  pan:0,    rev:0.12, dly:0,    duck:0.2, mute:false, solo:false } },
  { id:'smp',   name:'Sampler',  type:'inst', inst:'sampler', color:'#b9e35a', mix:{ db:-6,  pan:0,    rev:0.15, dly:0,    duck:0.25,mute:false, solo:false } }
];

const PRESETS = {
  trap: {
    label: 'Trap', bpm: 140, swing: 0, human: 0.2, key: 5, scale: 'minor', bars: 2,
    p808: { decay: 0.9, glide: 0.09, drive: 2.2 },
    drums: {
      kick:  'X-----x---x----- X-----x-x-------',
      snare: '--------X------- --------X-------',
      clap:  '--------x------- --------x-------',
      hat:   'x-x-x-x-x-x-x-3x x-x-x-x-x-xxx-46',
      ohat:  '-----------x---- -------------x--',
      perc:  '--------------o- ----------o---o-'
    },
    notes: {
      bass: [nt(0,5,'F1',1),nt(6,3,'F1',.85),nt(10,3,'Ab1',.95),nt(13,3,'Eb1',.95,true),
             nt(16,5,'F1',1),nt(22,2,'F1',.8),nt(24,4,'Bb1',.95),nt(28,4,'Ab1',.9,true)],
      keys: [nt(0,2,'C5',.7),nt(2,2,'Ab4',.6),nt(4,2,'F4',.6),nt(6,2,'Ab4',.55),nt(8,2,'C5',.7),nt(10,2,'Eb5',.65),nt(12,4,'C5',.6),
             nt(16,2,'Db5',.7),nt(18,2,'Ab4',.6),nt(20,2,'F4',.6),nt(22,2,'Ab4',.55),nt(24,2,'Bb4',.7),nt(26,2,'C5',.65),nt(28,4,'Ab4',.6)],
      pad: [...chord(0,16,['F3','Ab3','C4'],.5), ...chord(16,16,['Db3','F3','Ab3'],.5)]
    },
    mix: { keys:{ rev:0.32 }, pad:{ db:-15 } }
  },
  drill: {
    label: 'Drill', bpm: 142, swing: 0, human: 0.15, key: 2, scale: 'minor', bars: 2,
    p808: { decay: 0.75, glide: 0.12, drive: 2.4 },
    drums: {
      kick:  'X-----x---x----- X---x---x-------',
      snare: '--------X------- --------X-----o-',
      clap:  '--------x------- --------x-------',
      hat:   '3-x-3-x-3-x-3-x4 x-3-x-3-x-xx3-46',
      ohat:  '-----------x---- ----------------',
      perc:  '--x-----------x- ------x---x-----'
    },
    notes: {
      bass: [nt(0,5,'D1',1),nt(6,3,'D1',.85),nt(10,2,'F1',.95),nt(12,4,'G1',.95,true),
             nt(16,4,'D1',1),nt(20,2,'A1',.95),nt(22,2,'G1',.9,true),nt(24,5,'F1',.95),nt(29,3,'D1',.9,true)],
      keys: [nt(0,3,'F5',.7),nt(3,3,'D5',.6),nt(6,2,'A4',.6),nt(8,3,'F5',.7),nt(11,3,'E5',.6),nt(14,2,'D5',.6),
             nt(16,3,'F5',.7),nt(19,3,'D5',.6),nt(22,2,'Bb4',.6),nt(24,3,'F5',.7),nt(27,3,'G5',.6),nt(30,2,'F5',.6)],
      pad: [...chord(0,16,['D3','F3','A3','C4'],.5), ...chord(16,16,['Bb2','D3','F3'],.5)]
    },
    mix: { keys:{ rev:0.35, dly:0.12 }, pad:{ rev:0.55 } }
  },
  rnb: {
    label: 'R&B', bpm: 78, swing: 0.34, human: 0.3, key: 0, scale: 'major', bars: 2,
    p808: { decay: 1.5, glide: 0.14, drive: 1.2 },
    drums: {
      kick:  'X-----x--x------ X-----x-----x---',
      snare: '----X-------X--- ----X-------X---',
      clap:  '----x-------x--- ----x-------x---',
      hat:   'xoxoxoxoxoxoxoxo xoxoxoxoxoxoxo2x',
      ohat:  '-------------x-- ----------------',
      perc:  '--o-----o--o---- --o-----o-----o-'
    },
    notes: {
      bass: [nt(0,7,'F1',.9),nt(8,7,'E1',.9),nt(16,7,'D1',.9),nt(24,5,'G1',.9),nt(29,3,'A1',.8,true)],
      keys: [...chord(0,3,['F3','A3','C4','E4'],.65), ...chord(3,5,['F3','A3','C4','E4'],.55),
             ...chord(8,3,['E3','G3','B3','D4'],.65), ...chord(11,5,['E3','G3','B3','D4'],.55),
             ...chord(16,3,['D3','F3','A3','C4'],.65), ...chord(19,5,['D3','F3','A3','C4'],.55),
             ...chord(24,3,['G3','B3','D4','F4'],.65), ...chord(27,5,['G3','B3','D4','F4'],.55)],
      pluck: [nt(2,2,'A4',.6),nt(6,2,'C5',.55),nt(10,2,'G4',.6),nt(14,2,'B4',.55),nt(18,2,'F4',.6),nt(22,2,'A4',.55),nt(26,2,'D5',.6),nt(30,2,'B4',.55)],
      pad: [...chord(0,8,['A3','C4','E4'],.4), ...chord(8,8,['B3','D4','G4'],.4), ...chord(16,8,['A3','D4','F4'],.4), ...chord(24,8,['B3','D4','G4'],.4)]
    },
    mix: { keys:{ db:-8, rev:0.35 }, bass:{ db:-5 }, pad:{ db:-17 } }
  },
  afro: {
    label: 'Afrobeat', bpm: 102, swing: 0.16, human: 0.28, key: 9, scale: 'minor', bars: 2,
    p808: { decay: 0.3, glide: 0.06, drive: 0.9 },
    drums: {
      kick:  'X------x--x----- X--x---x-----x--',
      snare: '----X---o---X--- ----X---o---X---',
      clap:  '------o-------o- ------o-------o-',
      hat:   'oxoxoxoxoxoxoxox oxoxoxoxoxoxoxox',
      ohat:  '------x-------x- ------x-------x-',
      perc:  'x--x--x-x--x--x- x--x--x-x--x--x-'
    },
    notes: {
      bass: [nt(0,3,'A1',1),nt(3,3,'A1',.8),nt(6,2,'C2',.9),nt(8,3,'F1',1),nt(11,3,'F1',.8),nt(14,2,'G1',.9),
             nt(16,3,'C2',1),nt(19,3,'C2',.8),nt(22,2,'G1',.9),nt(24,3,'A1',1),nt(27,3,'A1',.8),nt(30,2,'F1',.9)],
      keys: [...[0,3,6,8,11,14].flatMap(s => chord(s,2,['A3','C4','E4','G4'],.55)),
             ...[16,19,22,24,27,30].flatMap(s => chord(s,2,['F3','A3','C4','E4'],.55))],
      pluck: [nt(0,1,'E4',.75),nt(2,1,'A4',.6),nt(3,1,'C5',.8),nt(6,1,'E5',.7),nt(7,1,'C5',.55),nt(10,1,'A4',.7),nt(11,1,'E4',.55),nt(14,1,'G4',.7),nt(15,1,'A4',.6),
              nt(16,1,'F4',.75),nt(18,1,'A4',.6),nt(19,1,'C5',.8),nt(22,1,'F5',.7),nt(23,1,'C5',.55),nt(26,1,'A4',.7),nt(27,1,'F4',.55),nt(30,1,'E4',.7),nt(31,1,'G4',.6)],
      organ: [...[2,6,10,14].flatMap(s => chord(s,1,['A3','C4','E4'],.55)), ...[18,22,26,30].flatMap(s => chord(s,1,['F3','A3','C4'],.55))],
      pad: [...chord(0,16,['A3','C4','E4','G4'],.35), ...chord(16,16,['F3','A3','C4','E4'],.35)]
    },
    mix: { bass:{ db:-3 }, pluck:{ db:-7, dly:0.2 }, keys:{ db:-12 } }
  }
};

function makeProject(key) {
  const pr = PRESETS[key], P = {
    genre: key, bpm: pr.bpm, swing: pr.swing, human: pr.human, key: pr.key, scale: pr.scale, lock: true, bars: pr.bars,
    p808: { ...pr.p808 }, channels: []
  };
  for (const def of CH_DEFS) {
    const d = JSON.parse(JSON.stringify(def));
    Object.assign(d.mix, (pr.mix && pr.mix[d.id]) || {});
    if (d.type === 'drum') { const r = row(pr.drums[d.id] || ''); d.v = r.v; d.r = r.r; }
    else d.notes = JSON.parse(JSON.stringify((pr.notes && pr.notes[d.id]) || []));
    P.channels.push(d);
  }
  return P;
}

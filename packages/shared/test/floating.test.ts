import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_FLOAT, EDGES, FLOAT_GRAB, FLOAT_STEP, FLOAT_STEP_FAST, FLOAT_TITLE_H, LAYOUT_PRESETS, MIN_FLOAT, PANELS,
  bringToFront, cascadeLayout, clampRect, defaultFloatRect, dockAll, dockPanel, fitFloating, floatPanel, isFloating, moveRect,
  nudgeRect, resizeRect, sanitizeFloating, setFloatRect, setFolded, tileLayout, toggleHidden, visibleFloating,
  type Bounds, type Edge, type WindowRect,
} from '../src/index';

const box: Bounds = { width: 1280, height: 640 };
const base = LAYOUT_PRESETS.beat.layout;
const min = MIN_FLOAT.roll;
const rect: WindowRect = { x: 200, y: 100, w: 600, h: 300 };

describe('clampRect', () => {
  it('leaves a window that fits alone', () => {
    assert.deepEqual(clampRect(rect, min, box), rect);
  });
  it('never lets a window get smaller than its panel needs, or bigger than the box', () => {
    const tiny = clampRect({ x: 0, y: 0, w: 10, h: 10 }, min, box);
    assert.equal(tiny.w, min.w);
    assert.equal(tiny.h, min.h);
    const huge = clampRect({ x: 0, y: 0, w: 9999, h: 9999 }, min, box);
    assert.equal(huge.w, box.width);
    assert.equal(huge.h, box.height);
  });
  it('keeps the title bar reachable: never above the box or below its last title-bar height', () => {
    const up = clampRect({ ...rect, y: -80 }, min, box);
    assert.equal(up.y, 0);
    const down = clampRect({ ...rect, y: 5000 }, min, box);
    assert.equal(down.y, box.height - FLOAT_TITLE_H);
  });
  it('lets a window hang off either side but keeps a strip to grab', () => {
    const left = clampRect({ ...rect, x: -5000 }, min, box);
    assert.equal(left.x + left.w, FLOAT_GRAB);
    const right = clampRect({ ...rect, x: 5000 }, min, box);
    assert.equal(right.x, box.width - FLOAT_GRAB);
  });
  it('still works in a box smaller than the minimum', () => {
    const r = clampRect(rect, min, { width: 300, height: 200 });
    assert.equal(r.w, min.w);
    assert.equal(r.h, min.h);
    assert.ok(r.y >= 0);
  });
});

describe('moveRect', () => {
  it('moves by the pointer delta and keeps the size', () => {
    assert.deepEqual(moveRect(rect, 30, -20, min, box), { ...rect, x: 230, y: 80 });
  });
  it('stops at the top edge', () => {
    assert.equal(moveRect(rect, 0, -999, min, box).y, 0);
  });
});

describe('resizeRect', () => {
  it('the east edge grows the width only', () => {
    assert.deepEqual(resizeRect(rect, 'e', 50, 999, min, box), { ...rect, w: 650 });
  });
  it('the west edge moves the left side and keeps the right side fixed', () => {
    const r = resizeRect(rect, 'w', -40, 0, min, box);
    assert.equal(r.x, 160);
    assert.equal(r.x + r.w, rect.x + rect.w);
  });
  it('the north edge keeps the bottom fixed', () => {
    const r = resizeRect(rect, 'n', 0, -30, min, box);
    assert.equal(r.y + r.h, rect.y + rect.h);
    assert.equal(r.h, rect.h + 30);
  });
  it('a corner moves two sides', () => {
    const r = resizeRect(rect, 'nw', -10, -10, min, box);
    assert.deepEqual(r, { x: 190, y: 90, w: 610, h: 310 });
  });
  it('stops at the minimum size and the opposite side does not move', () => {
    for (const edge of EDGES) {
      const r = resizeRect(rect, edge, edge.includes('w') ? 5000 : -5000, edge.includes('n') ? 5000 : -5000, min, box);
      assert.ok(r.w >= min.w && r.h >= min.h, `${edge}: ${r.w}x${r.h}`);
      if (edge.includes('w')) assert.equal(r.x + r.w, rect.x + rect.w, `${edge} right side`);
      if (edge.includes('e')) assert.equal(r.x, rect.x, `${edge} left side`);
      if (edge.includes('n')) assert.equal(r.y + r.h, rect.y + rect.h, `${edge} bottom side`);
      if (edge.includes('s')) assert.equal(r.y, rect.y, `${edge} top side`);
    }
  });
  it('the moving side cannot leave the box', () => {
    const r = resizeRect(rect, 'se', 9999, 9999, min, box);
    assert.equal(r.x + r.w, box.width);
    assert.equal(r.y + r.h, box.height);
    const t = resizeRect(rect, 'nw', -9999, -9999, min, box);
    assert.equal(t.x, 0);
    assert.equal(t.y, 0);
  });
  it('any edge, any drag: the result keeps its minimum size and stays inside the box', () => {
    const edges: Edge[] = [...EDGES];
    for (const edge of edges) {
      for (const d of [-9999, -120, -1, 0, 1, 120, 9999]) {
        const r = resizeRect(rect, edge, d, -d, min, box);
        assert.ok(r.w >= min.w && r.h >= min.h);
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= box.width && r.y + r.h <= box.height, `${edge} ${d}`);
      }
    }
  });
});

describe('keyboard nudging', () => {
  it('arrows move by 16 px and Ctrl makes it 64', () => {
    assert.equal(nudgeRect(rect, 'ArrowRight', { resize: false, fast: false }, min, box).x, rect.x + FLOAT_STEP);
    assert.equal(nudgeRect(rect, 'ArrowDown', { resize: false, fast: true }, min, box).y, rect.y + FLOAT_STEP_FAST);
  });
  it('with resize the arrows move the bottom-right corner', () => {
    const r = nudgeRect(rect, 'ArrowRight', { resize: true, fast: false }, min, box);
    assert.deepEqual(r, { ...rect, w: rect.w + FLOAT_STEP });
    const s = nudgeRect(rect, 'ArrowUp', { resize: true, fast: false }, min, box);
    assert.equal(s.h, rect.h - FLOAT_STEP);
  });
});

describe('defaultFloatRect', () => {
  it('opens each panel at a usable size, cascaded', () => {
    for (const id of PANELS) {
      const r = defaultFloatRect(id, box, 2);
      assert.equal(r.x, 24 + 64);
      assert.ok(r.w >= MIN_FLOAT[id].w && r.h >= MIN_FLOAT[id].h);
    }
  });
  it('shrinks to a small box rather than overflow', () => {
    const r = defaultFloatRect('roll', { width: 800, height: 500 }, 0);
    assert.ok(r.w <= 800 && r.h <= 500);
    assert.ok(DEFAULT_FLOAT.roll.w > r.w);
  });
});

describe('floating and docking', () => {
  it('floatPanel adds a window on top, unhides it and drops maximize', () => {
    const l = floatPanel({ ...base, hidden: ['roll'], maximized: 'roll' }, 'roll', rect, box);
    assert.ok(isFloating(l, 'roll'));
    assert.deepEqual(l.stack, ['roll']);
    assert.deepEqual(l.hidden, []);
    assert.equal(l.maximized, null);
  });
  it('the newest window is on top and floating a panel again keeps one entry', () => {
    let l = floatPanel(base, 'rack', rect, box);
    l = floatPanel(l, 'mixer', rect, box);
    l = floatPanel(l, 'rack', rect, box);
    assert.deepEqual(l.stack, ['mixer', 'rack']);
  });
  it('dockPanel removes only that window and does not touch the dock sizes', () => {
    let l = floatPanel(base, 'rack', rect, box);
    l = floatPanel(l, 'roll', rect, box);
    l = setFolded(l, 'roll', true);
    const d = dockPanel(l, 'roll');
    assert.ok(!isFloating(d, 'roll'));
    assert.ok(isFloating(d, 'rack'));
    assert.deepEqual(d.stack, ['rack']);
    assert.deepEqual(d.folded, []);
    assert.equal(d.rackW, base.rackW);
  });
  it('dockAll empties every window', () => {
    const l = dockAll(cascadeLayout(base, box));
    assert.deepEqual(l.floating, {});
    assert.deepEqual(l.stack, []);
  });
  it('setFloatRect clamps, and ignores a panel that is docked', () => {
    const l = floatPanel(base, 'roll', rect, box);
    assert.equal(setFloatRect(l, 'roll', { ...rect, y: -50 }, box).floating.roll?.y, 0);
    assert.equal(setFloatRect(base, 'roll', rect, box), base);
  });
  it('closing a window (hiding it) keeps its place for next time and takes it out of the visible list', () => {
    const l = toggleHidden(floatPanel(base, 'roll', rect, box), 'roll');
    assert.deepEqual(visibleFloating(l), []);
    assert.deepEqual(l.floating.roll, rect);
    assert.deepEqual(visibleFloating(toggleHidden(l, 'roll')), ['roll']);
  });
});

describe('bringToFront and fold', () => {
  it('raises a window to the end of the stack', () => {
    let l = floatPanel(floatPanel(base, 'rack', rect, box), 'mixer', rect, box);
    l = bringToFront(l, 'rack');
    assert.deepEqual(l.stack, ['mixer', 'rack']);
  });
  it('returns the same object when nothing changes', () => {
    const l = floatPanel(base, 'rack', rect, box);
    assert.equal(bringToFront(l, 'rack'), l);
    assert.equal(bringToFront(base, 'rack'), base);
    assert.equal(setFolded(l, 'rack', false), l);
  });
  it('folds and unfolds', () => {
    const l = setFolded(floatPanel(base, 'rack', rect, box), 'rack', true);
    assert.deepEqual(l.folded, ['rack']);
    assert.deepEqual(setFolded(l, 'rack', false).folded, []);
  });
});

describe('cascade and tile', () => {
  it('cascade floats every shown panel and every title bar stays visible', () => {
    const l = cascadeLayout({ ...base, hidden: ['playlist'] }, box);
    assert.deepEqual(Object.keys(l.floating).sort(), ['browser', 'mixer', 'rack', 'roll']);
    const tops = l.stack.map((id) => l.floating[id]?.y);
    assert.equal(new Set(tops).size, tops.length);
  });
  it('tile fills the box with no overlap', () => {
    const big: Bounds = { width: 1920, height: 900 };
    const l = tileLayout(base, big);
    const rs = PANELS.map((id) => l.floating[id] as WindowRect);
    for (const r of rs) assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= big.width && r.y + r.h <= big.height);
    for (let i = 0; i < rs.length; i++) {
      for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i] as WindowRect;
        const b = rs[j] as WindowRect;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        assert.ok(!overlap, `${PANELS[i]} overlaps ${PANELS[j]}`);
      }
    }
  });
  it('tile falls back to the cascade when the box is too small for a grid', () => {
    const small = tileLayout(base, box);
    assert.deepEqual(small, cascadeLayout(base, box));
  });
  it('tile of nothing is empty', () => {
    assert.deepEqual(tileLayout({ ...base, hidden: [...PANELS] }, box).floating, {});
  });
});

describe('fitFloating', () => {
  it('pulls windows back into a smaller box and keeps the same object when nothing moves', () => {
    const l = floatPanel(base, 'roll', { x: 900, y: 500, w: 700, h: 400 }, { width: 2560, height: 1440 });
    const f = fitFloating(l, { width: 1000, height: 600 });
    const r = f.floating.roll as WindowRect;
    assert.ok(r.x <= 1000 - FLOAT_GRAB && r.y <= 600 - FLOAT_TITLE_H && r.w <= 1000 && r.h <= 600);
    assert.equal(fitFloating(f, { width: 1000, height: 600 }), f);
  });
});

describe('sanitizeFloating', () => {
  it('keeps good windows, drops bad ones, and makes the stack cover every window', () => {
    const s = sanitizeFloating({
      floating: { roll: { x: 1, y: 2, w: 500, h: 300 }, rack: { x: 'a', y: 0, w: 1, h: 1 }, nope: { x: 0, y: 0, w: 9, h: 9 }, mixer: { x: 0, y: 0, w: -4, h: 9 } },
      stack: ['rack', 'roll', 'roll', 'bogus'],
      folded: ['roll', 'rack'],
    });
    assert.deepEqual(Object.keys(s.floating), ['roll']);
    assert.deepEqual(s.stack, ['roll']);
    assert.deepEqual(s.folded, ['roll']);
  });
  it('survives rubbish', () => {
    for (const junk of [null, undefined, 4, 'x', [], { floating: 7 }]) {
      assert.deepEqual(sanitizeFloating(junk), { floating: {}, stack: [], folded: [] });
    }
  });
});

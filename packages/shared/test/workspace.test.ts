import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LAYOUT_PRESETS, MIN_BROWSER_W, MIN_MIXER_H, MIN_RACK_W, MIN_ROLL_H, MIN_TOP_H, SPLITTER, fitLayout, isMobileWidth, setMaximized, splitterStep, toggleHidden } from '../src/index';

const beat = LAYOUT_PRESETS.beat.layout;

describe('fitLayout', () => {
  it('leaves a layout alone when there is room', () => {
    assert.deepEqual(fitLayout(beat, { width: 1920, height: 1080, barH: 48 }), beat);
  });
  it('never lets a panel fall below its minimum, on any realistic screen', () => {
    for (const [w, h] of [[1024, 600], [1280, 720], [1366, 768], [1536, 864], [1920, 1080], [2560, 1440]] as const) {
      for (const preset of Object.values(LAYOUT_PRESETS)) {
        const f = fitLayout(preset.layout, { width: w, height: h, barH: 48 });
        assert.ok(f.browserW >= MIN_BROWSER_W && f.rackW >= MIN_RACK_W, `${w}x${h} widths`);
        assert.ok(f.topH >= MIN_TOP_H && f.mixerH >= MIN_MIXER_H, `${w}x${h} heights`);
        const rollH = h - 48 - f.topH - f.mixerH - 2 * SPLITTER;
        assert.ok(rollH >= MIN_ROLL_H - 1 || h < 700, `${w}x${h} ${preset.label}: roll ${rollH}px`);
      }
    }
  });
  it('a layout saved on a huge monitor shrinks to fit a laptop', () => {
    const big = { ...beat, browserW: 400, rackW: 1200, topH: 700, mixerH: 600 };
    const f = fitLayout(big, { width: 1280, height: 720, barH: 48 });
    assert.ok(f.browserW + f.rackW < 1280);
    assert.ok(f.topH + f.mixerH < 720 - 48);
  });
  it('hidden panels take no space', () => {
    const f = fitLayout({ ...beat, hidden: ['browser', 'mixer'] }, { width: 1280, height: 720, barH: 48 });
    assert.equal(f.browserW, 0);
    assert.equal(f.mixerH, 0);
  });
});

describe('panel state', () => {
  it('maximize toggles, and maximizing a hidden panel shows it', () => {
    const m = setMaximized(beat, 'roll');
    assert.equal(m.maximized, 'roll');
    assert.equal(setMaximized(m, 'roll').maximized, null);
    const shown = setMaximized({ ...beat, hidden: ['mixer'] }, 'mixer');
    assert.deepEqual(shown.hidden, []);
    assert.equal(shown.maximized, 'mixer');
  });
  it('hiding the maximized panel restores the normal view', () => {
    const l = toggleHidden(setMaximized(beat, 'playlist'), 'playlist');
    assert.equal(l.maximized, null);
    assert.deepEqual(l.hidden, ['playlist']);
    assert.deepEqual(toggleHidden(l, 'playlist').hidden, []);
  });
  it('knows narrow screens and keyboard steps', () => {
    assert.equal(isMobileWidth(390), true);
    assert.equal(isMobileWidth(768), false);
    assert.equal(splitterStep(false), 16);
    assert.equal(splitterStep(true), 64);
  });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURES, MODES, MODE_DEFAULTS, MODE_LABELS, MODE_SUMMARIES, atLeast, isFeatureVisible, isMode, visibleFeatures, type Mode } from '../src/index';

const ids = (mode: Mode, o = {}) => new Set(visibleFeatures(mode, o).map((f) => f.id));

test('feature ids are unique and ranges make sense', () => {
  const seen = new Set<string>();
  for (const f of FEATURES) {
    assert.ok(!seen.has(f.id), `duplicate ${f.id}`);
    seen.add(f.id);
    if (f.from && f.until) assert.ok(atLeast(f.until, f.from), `${f.id}: until is below from`);
    if (f.kind === 'guidance') assert.equal(f.from, undefined, `${f.id}: guidance is never gated upward`);
  }
});

test('every mode has a label, a summary and defaults', () => {
  for (const m of MODES) {
    assert.ok(MODE_LABELS[m] && MODE_SUMMARIES[m] && MODE_DEFAULTS[m], m);
  }
});

test('beginner gets guidance, the starters and the core workshop, not the technical depth', () => {
  const v = ids('beginner');
  for (const id of ['coach-marks', 'guided-builder', 'plain-language', 'vibe-starter', 'keyboard-piano', 'sound-browser']) assert.ok(v.has(id), id);
  // a beginner must be able to make a beat: the step grid, the roll and a simple mixer are always there
  for (const id of ['channel-rack', 'piano-roll', 'mixer', 'project-files', 'export-wav', 'transport-previews']) assert.ok(v.has(id), id);
  for (const id of ['playlist', 'step-editor', 'velocity-lane', 'mixer-sends', 'mixer-routing', 'per-note-properties', 'automation-editor']) assert.ok(!v.has(id), id);
});

test('standard has the full workspace and drops beginner-only scaffolding', () => {
  const v = ids('standard');
  for (const id of ['channel-rack', 'piano-roll', 'playlist', 'mixer', 'chord-brain', 'explain-suggestions', 'safety-rails']) assert.ok(v.has(id), id);
  for (const id of ['coach-marks', 'guided-builder', 'plain-language', 'mixer-routing', 'tempo-map']) assert.ok(!v.has(id), id);
});

test('pro has every tool and no beginner guidance by default', () => {
  const v = ids('pro');
  for (const f of FEATURES.filter((x) => x.kind === 'tool')) assert.ok(v.has(f.id), f.id);
  for (const f of FEATURES.filter((x) => x.kind === 'guidance')) assert.ok(!v.has(f.id), f.id);
});

test('modes only ever add tools going up (nothing a Beginner can use disappears in Pro)', () => {
  const tools = (m: Mode) => new Set(visibleFeatures(m).filter((f) => f.kind === 'tool').map((f) => f.id));
  for (const t of tools('beginner')) assert.ok(tools('standard').has(t), `standard lost ${t}`);
  for (const t of tools('standard')) assert.ok(tools('pro').has(t), `pro lost ${t}`);
});

test('guidance can be forced on for a Pro user or off for a Beginner', () => {
  assert.ok(isFeatureVisible('coach-marks', 'pro', { guidance: true }));
  assert.ok(!isFeatureVisible('coach-marks', 'beginner', { guidance: false }));
  // The override never reveals a tool the mode does not include.
  assert.ok(!isFeatureVisible('mixer-routing', 'beginner', { guidance: true }));
});

test('unknown feature ids and bad mode values are rejected', () => {
  assert.equal(isFeatureVisible('does-not-exist', 'pro'), false);
  assert.equal(isMode('pro'), true);
  assert.equal(isMode('expert'), false);
  assert.equal(isMode(undefined), false);
});

test('beginner defaults are the safest and pro defaults get out of the way', () => {
  assert.equal(MODE_DEFAULTS.beginner.density, 'comfortable');
  assert.equal(MODE_DEFAULTS.beginner.scaleSnap, true);
  assert.equal(MODE_DEFAULTS.pro.density, 'compact');
  assert.equal(MODE_DEFAULTS.pro.confirmDestructive, false);
});

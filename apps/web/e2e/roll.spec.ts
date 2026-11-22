import { expect, test, type Page } from '@playwright/test';
import { expectNotes, forceSave, notesOf, openApp, rollGeometry, selectChannel, type Note } from './helpers';

/** A pitch row in the visible part of the roll with no note on it, so a click there draws. */
async function emptyPitch(page: Page, used: number[]) {
  const g = await rollGeometry(page);
  for (let p = 108; p > 12; p--) {
    const top = g.y(p);
    if (top > g.box.y + 4 && top + g.rowH < g.box.y + g.box.height - 4 && !used.includes(p)) return { g, pitch: p };
  }
  throw new Error('no empty row in view');
}

/** A note that is fully on screen in the roll, so a click on it lands. The default view shows only part of the pitch range. */
async function visibleNote(page: Page, notes: Note[]) {
  const g = await rollGeometry(page);
  const hit = notes.find((n) => {
    const y = g.y(n.n);
    const x = g.x(n.t + 0.5);
    return y > g.box.y + 2 && y + g.rowH < g.box.y + g.box.height - 2 && x > g.box.x + 2 && x < g.box.x + g.box.width - 2;
  });
  if (!hit) throw new Error('no note is in view');
  return { g, note: hit };
}

test.use({ viewport: { width: 1280, height: 800 } });

test.describe('piano roll with the mouse', () => {
  test('draw, move and resize a note; each gesture is one undo step', async ({ page }) => {
    const app = await openApp(page);
    await selectChannel(page, '808');
    await forceSave(page);
    const before = await notesOf(page, '808');
    const { g, pitch } = await emptyPitch(page, before.map((n) => n.n));
    const mid = g.rowH / 2;

    // draw: press in step 8, drag to step 10
    await page.mouse.move(g.x(8) + 3, g.y(pitch) + mid);
    await page.mouse.down();
    await page.mouse.move(g.x(10) + 3, g.y(pitch) + mid, { steps: 4 });
    await page.mouse.up();
    const drawn = (await expectNotes(page, '808', (ns) => ns.length === before.length + 1, 'a note was drawn')).find((n) => !before.some((b) => b.id === n.id))!;
    expect(drawn.t).toBeCloseTo(8, 5);
    expect(drawn.d).toBeCloseTo(2, 5);
    expect(drawn.n).toBe(pitch);

    // move: three steps right, one semitone up
    await page.mouse.move(g.x(8.6), g.y(pitch) + mid);
    await page.mouse.down();
    await page.mouse.move(g.x(11.6), g.y(pitch + 1) + mid, { steps: 6 });
    await page.mouse.up();
    const moved = (await expectNotes(page, '808', (ns) => ns.some((n) => n.id === drawn.id && Math.abs(n.t - 11) < 0.01), 'the note moved')).find((n) => n.id === drawn.id)!;
    expect(moved.n).toBe(pitch + 1);

    // resize: drag the right edge two steps
    const edge = g.x(moved.t + moved.d) - 2;
    await page.mouse.move(edge, g.y(moved.n) + mid);
    await page.mouse.down();
    await page.mouse.move(edge + 2 * g.stepW, g.y(moved.n) + mid, { steps: 5 });
    await page.mouse.up();
    await expectNotes(page, '808', (ns) => ns.some((n) => n.id === drawn.id && Math.abs(n.d - 4) < 0.01), 'the note was resized');

    for (let i = 0; i < 3; i++) await page.keyboard.press('Control+z');
    await expectNotes(page, '808', (ns) => ns.length === before.length, 'three undos remove draw, move and resize');
    for (let i = 0; i < 3; i++) await page.keyboard.press('Control+Shift+z');
    await expectNotes(page, '808', (ns) => ns.some((n) => n.id === drawn.id && Math.abs(n.d - 4) < 0.01), 'redo brings it back');
    expect(app.problems).toEqual([]);
  });

  test('right-click and the erase tool delete notes', async ({ page }) => {
    await openApp(page);
    await selectChannel(page, '808');
    await forceSave(page);
    const start = await notesOf(page, '808');
    const { g, note: first } = await visibleNote(page, start);
    await page.mouse.click(g.x(first.t + 0.5), g.y(first.n) + g.rowH / 2, { button: 'right' });
    await expectNotes(page, '808', (ns) => !ns.some((n) => n.id === first.id), 'right-click deleted the note');

    await page.getByRole('button', { name: 'Erase', exact: true }).click();
    const { g: g2, note: second } = await visibleNote(page, await notesOf(page, '808'));
    await page.mouse.click(g2.x(second.t + 0.5), g2.y(second.n) + g2.rowH / 2);
    await expectNotes(page, '808', (ns) => !ns.some((n) => n.id === second.id), 'the erase tool deleted the note');
  });

  test('box select, select all, and the velocity lane', async ({ page }) => {
    await openApp(page);
    await selectChannel(page, '808');
    await forceSave(page);
    const start = await notesOf(page, '808');
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    const g = await rollGeometry(page);
    await page.mouse.move(g.box.x + 2, g.box.y + 2);
    await page.mouse.down();
    await page.mouse.move(g.box.x + g.box.width - 4, g.box.y + g.box.height - 4, { steps: 8 });
    await page.mouse.up();
    const selected = page.locator('ul[aria-label="Notes in this channel"] li', { hasText: ', selected' });
    // the box covers the part of the roll that is on screen, so it picks up the notes in view
    const inView = start.filter((n) => g.y(n.n) < g.box.y + g.box.height && g.y(n.n) + g.rowH > g.box.y).length;
    await expect(selected).toHaveCount(inView);
    expect(inView).toBeGreaterThan(0);

    // select all takes every note, in view or not
    await page.locator('.roll-scroll').focus();
    await page.keyboard.press('Control+a');
    await expect(selected).toHaveCount(start.length);

    // lower one note's velocity by dragging its bar in the lane
    await page.keyboard.press('Escape');
    await expect(selected).toHaveCount(0);
    const target = start[0]!;
    const lane = (await page.locator('.roll-lane canvas').boundingBox())!;
    const x = lane.x + target.t * g.stepW - g.sx;
    await page.mouse.move(x, lane.y + 8);
    await page.mouse.down();
    await page.mouse.move(x, lane.y + lane.height - 4, { steps: 6 });
    await page.mouse.up();
    const after = (await expectNotes(page, '808', (ns) => (ns.find((n) => n.id === target.id)?.v ?? 1) < 0.3, 'velocity dropped')).find((n) => n.id === target.id)!;
    expect(after.v).toBeGreaterThanOrEqual(0.05);
  });

  test('zoom buttons, ctrl+wheel and the pan tool move the view', async ({ page }) => {
    await openApp(page);
    await selectChannel(page, '808');
    const g0 = await rollGeometry(page);
    await page.getByRole('button', { name: 'Zoom in time' }).click();
    await expect.poll(async () => (await rollGeometry(page)).stepW).toBeGreaterThan(g0.stepW);
    await page.getByRole('button', { name: 'Zoom in pitch' }).click();
    await expect.poll(async () => (await rollGeometry(page)).rowH).toBeGreaterThan(g0.rowH);

    const g1 = await rollGeometry(page);
    await page.mouse.move(g1.box.x + 300, g1.box.y + 60);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, 300);
    await page.keyboard.up('Control');
    await expect.poll(async () => (await rollGeometry(page)).stepW).toBeLessThan(g1.stepW);

    await page.getByRole('button', { name: 'Pan', exact: true }).click();
    const g2 = await rollGeometry(page);
    await page.mouse.move(g2.box.x + 400, g2.box.y + 120);
    await page.mouse.down();
    await page.mouse.move(g2.box.x + 400, g2.box.y + 40, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => (await rollGeometry(page)).sy).not.toBe(g2.sy);
  });
});

test.describe('piano roll with the keyboard only', () => {
  test('Enter adds, Shift+arrows move, Alt+arrows lengthen, brackets change velocity, Delete removes', async ({ page }) => {
    const app = await openApp(page);
    await selectChannel(page, '808');
    await forceSave(page);
    const before = await notesOf(page, '808');
    await page.locator('.roll-scroll').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.locator('.status-message')).toContainText('Added');
    const added = (await expectNotes(page, '808', (ns) => ns.length === before.length + 1, 'Enter added a note')).find((n) => !before.some((b) => b.id === n.id))!;

    await page.keyboard.press('Shift+ArrowRight');
    await expectNotes(page, '808', (ns) => Math.abs((ns.find((n) => n.id === added.id)?.t ?? -1) - (added.t + 1)) < 0.01, 'moved one step');
    await page.keyboard.press('Alt+ArrowRight');
    await expectNotes(page, '808', (ns) => (ns.find((n) => n.id === added.id)?.d ?? 0) > added.d, 'lengthened');
    await page.keyboard.press(']');
    await expectNotes(page, '808', (ns) => (ns.find((n) => n.id === added.id)?.v ?? 0) > added.v, 'louder');
    await page.keyboard.press('Delete');
    await expectNotes(page, '808', (ns) => !ns.some((n) => n.id === added.id), 'deleted');
    await expect(page.locator('.status-message')).toContainText('Press Undo');
    expect(app.problems).toEqual([]);
  });

  test('every note is listed for screen readers, with position and velocity', async ({ page }) => {
    await openApp(page);
    await selectChannel(page, '808');
    const items = page.locator('ul[aria-label="Notes in this channel"] li');
    await expect(items.first()).toContainText(/^[A-G]#?\d, \d+\.\d+\.\d+, [\d.]+ steps? long, velocity \d+ percent/);
  });

  test('typing-piano letters are left to the piano, so the roll does not swallow them', async ({ page }) => {
    await openApp(page, { audio: true });
    await selectChannel(page, 'Keys');
    await page.locator('.roll-scroll').focus();
    await page.keyboard.down('z');
    await expect.poll(() => page.evaluate(() => window.__peak())).toBeGreaterThan(0.01);
    await page.keyboard.up('z');
  });
});

test.describe('piano roll and the experience modes', () => {
  test('a drum channel explains where its notes live and the channel list offers instruments', async ({ page }) => {
    await openApp(page);
    await selectChannel(page, 'Kick');
    await expect(page.locator('.roll .empty')).toContainText('Drum channels use the step grid');
    const options = page.locator('.roll-tools-slot select').first().locator('option:not([disabled])');
    await expect(options).toContainText(['808', 'Keys']);
  });

  test('Beginner has no velocity lane and snaps drawn notes to the key; Pro adds Slide and MIDI numbers', async ({ page }) => {
    await openApp(page, { mode: 'beginner' });
    await selectChannel(page, '808');
    await expect(page.locator('.roll-lane')).toHaveCount(0);
    await forceSave(page);
    const before = await notesOf(page, '808');
    const { g, pitch } = await emptyPitch(page, before.map((n) => n.n));
    // C minor: a black key such as C# is outside the scale. Draw on a row, then check the pitch class belongs to it.
    await page.mouse.click(g.x(20) + 3, g.y(pitch) + g.rowH / 2);
    const drawn = (await expectNotes(page, '808', (ns) => ns.length === before.length + 1, 'drawn')).find((n) => !before.some((b) => b.id === n.id))!;
    const cMinor = new Set([0, 2, 3, 5, 7, 8, 10]);
    expect(cMinor.has(drawn.n % 12), `pitch ${drawn.n} should be in C minor`).toBe(true);

  });

  test('Pro shows Slide, and the hover readout includes the MIDI number', async ({ page }) => {
    await openApp(page, { mode: 'pro' });
    await selectChannel(page, '808');
    await expect(page.getByRole('button', { name: 'Slide' })).toBeVisible();
    const g = await rollGeometry(page);
    await page.mouse.move(g.box.x + 200, g.box.y + 60);
    await expect(page.locator('.roll-readout')).toHaveText(/\(\d+\)/);
  });
});

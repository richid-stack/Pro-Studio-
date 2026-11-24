import { expect, test, type Locator, type Page } from '@playwright/test';
import { openApp } from './helpers';

const win = (page: Page, name: string): Locator => page.locator(`section.fwin[data-panel="${name}"]`);

async function box(l: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const b = await l.boundingBox();
  if (!b) throw new Error('not visible');
  return b;
}

/** Drag from a point in the first row of a window's title bar (the title text), where no button sits. */
async function dragTitle(page: Page, w: Locator, dx: number, dy: number): Promise<void> {
  const b = await box(w.locator('.fwin-bar'));
  await page.mouse.move(b.x + 16, b.y + 12);
  await page.mouse.down();
  await page.mouse.move(b.x + 16 + dx / 2, b.y + 12 + dy / 2, { steps: 4 });
  await page.mouse.move(b.x + 16 + dx, b.y + 12 + dy, { steps: 4 });
  await page.mouse.up();
}

test.describe('floating windows', () => {
  test('a panel pops out of the dock into a window and takes no room in the dock', async ({ page }) => {
    const app = await openApp(page);
    await page.getByRole('button', { name: 'Pop out Piano roll into a window' }).click();
    await expect(win(page, 'roll')).toBeVisible();
    await expect(page.locator('.workspace section.panel[data-panel="roll"]')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Piano roll', exact: true })).toHaveCount(1);
    expect(app.problems).toEqual([]);
  });

  test('dragging the title bar moves the window', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Pop out Piano roll into a window' }).click();
    const w = win(page, 'roll');
    const before = await box(w);
    await dragTitle(page, w, 120, 50);
    const after = await box(w);
    expect(Math.abs(after.x - before.x - 120)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.y - before.y - 50)).toBeLessThanOrEqual(1);
    expect(after.width).toBe(before.width);
  });

  test('a window cannot be dragged above the workspace or lose its title bar', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Pop out Piano roll into a window' }).click();
    const w = win(page, 'roll');
    const workspace = await box(page.locator('#workspace'));
    await dragTitle(page, w, 0, -2000);
    expect((await box(w)).y).toBeGreaterThanOrEqual(workspace.y - 1);
    await dragTitle(page, w, 0, 4000);
    const b = await box(w);
    expect(b.y).toBeLessThan(workspace.y + workspace.height - 20);
  });

  test('every edge and corner resizes, and a window stops at its minimum size', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Pop out Piano roll into a window' }).click();
    const w = win(page, 'roll');
    await dragTitle(page, w, -150, -120); // make room to grow on every side
    const a = await box(w);
    // south-east corner grows both ways
    await page.mouse.move(a.x + a.width - 3, a.y + a.height - 3);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width + 37, a.y + a.height + 27, { steps: 4 });
    await page.mouse.up();
    const b = await box(w);
    expect(Math.round(b.width - a.width)).toBe(40);
    expect(Math.round(b.height - a.height)).toBe(30);
    // west edge: the right side stays put
    await page.mouse.move(b.x + 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x - 58, b.y + b.height / 2, { steps: 4 });
    await page.mouse.up();
    const c = await box(w);
    expect(Math.round(c.width - b.width)).toBe(60);
    expect(Math.round(c.x + c.width - (b.x + b.width))).toBe(0);
    // far past the minimum from the north-west corner
    await page.mouse.move(c.x + 3, c.y + 3);
    await page.mouse.down();
    await page.mouse.move(c.x + 3 + 5000, c.y + 3 + 5000, { steps: 4 });
    await page.mouse.up();
    const d = await box(w);
    expect(d.width).toBeGreaterThanOrEqual(420);
    expect(d.height).toBeGreaterThanOrEqual(240);
    expect(Math.round(d.x + d.width - (c.x + c.width))).toBe(0);
    expect(Math.round(d.y + d.height - (c.y + c.height))).toBe(0);
  });

  test('Escape cancels a drag and the window goes back', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Pop out Piano roll into a window' }).click();
    const w = win(page, 'roll');
    const before = await box(w);
    const bar = await box(w.locator('.fwin-bar'));
    await page.mouse.move(bar.x + 16, bar.y + 12);
    await page.mouse.down();
    await page.mouse.move(bar.x + 216, bar.y + 112, { steps: 4 });
    expect((await box(w)).x).toBeGreaterThan(before.x + 100);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect(await box(w)).toEqual(before);
  });

  test('the title is a keyboard handle: arrows move, Shift+arrows resize, Ctrl goes four times as far', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Pop out Mixer into a window' }).click();
    const w = win(page, 'mixer');
    const handle = w.getByRole('button', { name: 'Mixer', exact: true });
    await handle.focus();
    const a = await box(w);
    await page.keyboard.press('ArrowRight');
    expect(Math.round((await box(w)).x - a.x)).toBe(16);
    await page.keyboard.press('Control+ArrowDown');
    expect(Math.round((await box(w)).y - a.y)).toBe(64);
    const b = await box(w);
    await page.keyboard.press('Shift+ArrowRight');
    expect(Math.round((await box(w)).width - b.width)).toBe(16);
    await expect(handle).toBeFocused();
  });

  test('dragging a docked title bar pulls the panel out and the window follows the pointer', async ({ page }) => {
    const app = await openApp(page);
    const head = await box(page.locator('.workspace section.panel[data-panel="rack"] .panel-header'));
    await page.mouse.move(head.x + 90, head.y + head.height / 2);
    await page.mouse.down();
    await page.mouse.move(head.x + 140, head.y + 60, { steps: 5 });
    await page.mouse.move(head.x + 400, head.y + 140, { steps: 5 });
    await expect(win(page, 'rack')).toBeVisible();
    const during = await box(win(page, 'rack'));
    await page.mouse.move(head.x + 500, head.y + 200, { steps: 5 });
    await page.mouse.up();
    const after = await box(win(page, 'rack'));
    expect(after.x - during.x).toBeGreaterThan(80);
    expect(app.problems).toEqual([]);
  });

  test('clicking a window raises it above the others', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Pop out Channel rack into a window' }).click();
    await page.getByRole('button', { name: 'Pop out Mixer into a window' }).click();
    const z = (n: string): Promise<number> => win(page, n).evaluate((el) => Number(getComputedStyle(el).zIndex));
    expect(await z('mixer')).toBeGreaterThan(await z('rack'));
    await win(page, 'rack').locator('.panel-header').click({ position: { x: 20, y: 10 } });
    expect(await z('rack')).toBeGreaterThan(await z('mixer'));
    await expect(win(page, 'rack')).toHaveAttribute('data-active', 'true');
  });

  test('fold, dock, maximize and close each do what they say', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Pop out Piano roll into a window' }).click();
    const w = win(page, 'roll');
    const full = await box(w);

    await w.getByRole('button', { name: 'Collapse Piano roll to its title bar' }).click();
    await expect(w).toHaveAttribute('data-folded', 'true');
    expect((await box(w)).height).toBeLessThan(full.height / 2);
    await w.getByRole('button', { name: 'Expand Piano roll' }).click();
    expect(Math.abs((await box(w)).height - full.height)).toBeLessThanOrEqual(1);

    await w.getByRole('button', { name: 'Maximize Piano roll' }).click();
    await expect(page.getByRole('button', { name: 'Restore Piano roll' })).toBeVisible();
    await expect(page.locator('section.fwin')).toHaveCount(0);
    await page.getByRole('button', { name: 'Restore Piano roll' }).click();
    await expect(w).toBeVisible();
    expect(Math.abs((await box(w)).x - full.x)).toBeLessThanOrEqual(1);

    await w.getByRole('button', { name: 'Close Piano roll' }).click();
    await expect(page.getByRole('heading', { name: 'Piano roll', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'View', exact: true }).click();
    await page.getByRole('menuitemcheckbox', { name: /Piano roll/ }).click();
    await expect(w).toBeVisible();
    expect(Math.abs((await box(w)).x - full.x)).toBeLessThanOrEqual(1);

    await w.getByRole('button', { name: 'Dock Piano roll back into the layout' }).click();
    await expect(w).toHaveCount(0);
    await expect(page.locator('.workspace section.panel[data-panel="roll"]')).toBeVisible();
  });

  test('windows are remembered across a reload', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Pop out Mixer into a window' }).click();
    await dragTitle(page, win(page, 'mixer'), 60, 30);
    const placed = await box(win(page, 'mixer'));
    await page.reload();
    await expect(win(page, 'mixer')).toBeVisible();
    const again = await box(win(page, 'mixer'));
    expect(Math.abs(again.x - placed.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(again.y - placed.y)).toBeLessThanOrEqual(1);
  });

  test('the View menu cascades, tiles and docks every window', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'View', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Cascade windows' }).click();
    await expect(page.locator('section.fwin')).toHaveCount(5);
    await page.getByRole('button', { name: 'View', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Tile windows' }).click();
    await expect(page.locator('section.fwin')).toHaveCount(5);
    await page.getByRole('button', { name: 'View', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Dock all windows' }).click();
    await expect(page.locator('section.fwin')).toHaveCount(0);
    await expect(page.locator('.workspace section.panel')).toHaveCount(5);
  });

  test('Beginner mode and the phone layout have no floating windows', async ({ page }) => {
    await openApp(page, { mode: 'beginner' });
    await expect(page.getByRole('button', { name: /^Pop out / })).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 800 });
    await expect(page.getByRole('button', { name: /^Pop out / })).toHaveCount(0);
  });

  test('a saved window that no longer fits is pulled back into the workspace', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('prostudio.layout.v1') ?? '{"preset":"beat","layout":{}}');
      raw.layout.floating = { roll: { x: 4000, y: 3000, w: 900, h: 500 } };
      raw.layout.stack = ['roll'];
      localStorage.setItem('prostudio.layout.v1', JSON.stringify(raw));
    });
    await page.reload();
    const w = win(page, 'roll');
    await expect(w).toBeVisible();
    const workspace = await box(page.locator('#workspace'));
    const b = await box(w);
    expect(b.x).toBeLessThan(workspace.x + workspace.width - 40);
    expect(b.y).toBeLessThan(workspace.y + workspace.height - 20);
  });
});

import { expect, test, type Page } from '@playwright/test';
import { openApp, selectChannel } from './helpers';

const peak = (page: Page) => page.evaluate(() => window.__peak());

test.describe('laptop keyboard piano', () => {
  test('plays notes with real sound and stops after release', async ({ page }) => {
    const app = await openApp(page, { audio: true });
    await selectChannel(page, 'Keys');
    await page.keyboard.down('z');
    await expect.poll(() => peak(page), { timeout: 8000 }).toBeGreaterThan(0.01);
    expect(await page.evaluate(() => window.__ctx?.state)).toBe('running');
    await page.keyboard.up('z');
    await expect.poll(() => peak(page), { timeout: 10_000 }).toBeLessThan(0.002);
    expect(app.problems).toEqual([]);
  });

  test('the 808 makes sound too', async ({ page }) => {
    await openApp(page, { audio: true });
    await selectChannel(page, '808');
    await page.keyboard.down('z');
    await expect.poll(() => peak(page), { timeout: 8000 }).toBeGreaterThan(0.01);
    await page.keyboard.up('z');
  });

  test('typing in a text field never plays a note or fires a shortcut', async ({ page }) => {
    await openApp(page, { audio: true });
    await selectChannel(page, 'Keys');
    const name = page.getByRole('textbox', { name: 'Project name' });
    await name.click();
    await name.press('End');
    await page.keyboard.type('zxcv ?');
    expect(await peak(page)).toBeLessThan(0.002);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(name).toHaveValue(/zxcv \?$/);
  });

  test('Ctrl and letter keys are not notes, and losing focus releases held notes', async ({ page }) => {
    await openApp(page, { audio: true });
    await selectChannel(page, 'Keys');
    await page.keyboard.down('Control');
    await page.keyboard.press('z');
    await page.keyboard.up('Control');
    expect(await peak(page)).toBeLessThan(0.002);

    await page.keyboard.down('z');
    await expect.poll(() => peak(page), { timeout: 8000 }).toBeGreaterThan(0.01);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect.poll(() => peak(page), { timeout: 10_000 }).toBeLessThan(0.002);
  });
});

test.describe('playback', () => {
  test('Space plays the beat with real sound and the position advances; Shift+Space stops', async ({ page }) => {
    const app = await openApp(page, { audio: true });
    const position = page.getByLabel('Position in bars, beats and steps');
    await expect(position).toHaveText('1.1.1');
    await page.keyboard.press('Space');
    await expect.poll(() => peak(page), { timeout: 10_000 }).toBeGreaterThan(0.02);
    await expect.poll(async () => (await position.textContent())?.trim(), { timeout: 10_000 }).not.toBe('1.1.1');
    await page.keyboard.press('Shift+Space');
    await expect(position).toHaveText('1.1.1');
    await expect.poll(() => peak(page), { timeout: 15_000 }).toBeLessThan(0.002);
    expect(app.problems).toEqual([]);
  });

  test('the master meters move while it plays', async ({ page }) => {
    await openApp(page, { audio: true });
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect.poll(() => peak(page), { timeout: 10_000 }).toBeGreaterThan(0.02);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
  });
});

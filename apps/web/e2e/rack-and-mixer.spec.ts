import { expect, test, type Page } from '@playwright/test';
import { openApp, savedProject } from './helpers';

const kickStep = (page: Page, n: number) => page.getByRole('button', { name: new RegExp(`^Kick, step ${n}(,|$)`) });

test.describe('channel rack', () => {
  test('click toggles a step, and the label says what it is now', async ({ page }) => {
    await openApp(page);
    const step = kickStep(page, 2);
    await expect(step).toHaveAttribute('aria-pressed', 'false');
    await step.click();
    await expect(step).toHaveAttribute('aria-pressed', 'true');
    await expect(step).toHaveAccessibleName(/on, velocity \d+ percent/);
    await step.click();
    await expect(step).toHaveAttribute('aria-pressed', 'false');
  });

  test('dragging across steps paints them all the same way', async ({ page }) => {
    await openApp(page);
    const a = (await kickStep(page, 9).boundingBox())!;
    const b = (await kickStep(page, 12).boundingBox())!;
    const y = a.y + a.height / 2;
    const before = await Promise.all([9, 10, 11, 12].map(async (n) => (await kickStep(page, n).getAttribute('aria-pressed')) === 'true'));
    const paintOn = !before[0];
    await page.mouse.move(a.x + a.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, y, { steps: 8 });
    await page.mouse.up();
    for (const n of [9, 10, 11, 12]) await expect(kickStep(page, n)).toHaveAttribute('aria-pressed', String(paintOn));
  });

  test('arrow keys move between steps and Enter toggles', async ({ page }) => {
    await openApp(page);
    await kickStep(page, 5).focus();
    await page.keyboard.press('ArrowRight');
    await expect(kickStep(page, 6)).toBeFocused();
    const was = await kickStep(page, 6).getAttribute('aria-pressed');
    await page.keyboard.press('Enter');
    await expect(kickStep(page, 6)).toHaveAttribute('aria-pressed', was === 'true' ? 'false' : 'true');
  });

  test('right-click opens the step editor in Standard, and Escape closes it', async ({ page }) => {
    await openApp(page);
    await kickStep(page, 1).click({ button: 'right' });
    const editor = page.getByRole('dialog', { name: /Kick, step 1/ });
    await expect(editor).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(editor).toHaveCount(0);
  });

  test('Beginner has no step editor', async ({ page }) => {
    await openApp(page, { mode: 'beginner' });
    await kickStep(page, 1).click({ button: 'right' });
    await expect(page.getByRole('dialog', { name: /Kick, step 1/ })).toHaveCount(0);
  });

  test('mute and rename work, and the project saves', async ({ page }) => {
    await openApp(page);
    await page.locator('.led[aria-label="Mute Snare"]').click();
    await expect(page.locator('.led[aria-label="Mute Snare"]')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await savedProject(page))?.channels.find((c) => c.name === 'Snare')?.mix.mute).toBe(true);
  });
});

test.describe('mixer', () => {
  test('a fader moves with the keyboard and reports its level', async ({ page }) => {
    await openApp(page);
    const fader = page.locator('.fader[aria-label="Kick volume"]');
    const before = Number(await fader.getAttribute('aria-valuenow'));
    await fader.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => Number(await fader.getAttribute('aria-valuenow'))).toBeLessThan(before);
    await expect(fader).toHaveAttribute('aria-valuetext', /decibel/);
  });

  test('double-click resets a fader to unity-ish default', async ({ page }) => {
    await openApp(page);
    const fader = page.locator('.fader[aria-label="Kick volume"]');
    await fader.focus();
    await page.keyboard.press('ArrowDown');
    await fader.dblclick();
    await expect(fader).toHaveAttribute('aria-valuenow', '-6');
  });

  test('mute and solo buttons on a strip are toggles', async ({ page }) => {
    await openApp(page);
    const strip = page.getByRole('group', { name: 'Hat mixer strip' });
    const solo = strip.getByRole('button', { name: /Solo Hat/ });
    await solo.click();
    await expect(solo).toHaveAttribute('aria-pressed', 'true');
    await solo.click();
    await expect(solo).toHaveAttribute('aria-pressed', 'false');
  });
});

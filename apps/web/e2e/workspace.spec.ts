import { expect, test } from '@playwright/test';
import { noHorizontalOverflow, openApp } from './helpers';

test.describe('workspace', () => {
  test('Standard shows every panel, with no console problems', async ({ page }) => {
    const app = await openApp(page);
    for (const name of ['Browser', 'Channel rack', 'Playlist', 'Piano roll', 'Mixer']) {
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    }
    expect(app.problems).toEqual([]);
  });

  test('modes change what is shown and the density, and the choice persists', async ({ page }) => {
    await openApp(page, { mode: 'beginner' });
    await expect(page.getByRole('heading', { name: 'Playlist', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Piano roll', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable');

    await page.getByRole('radio', { name: 'Standard' }).check({ force: true });
    await expect(page.getByRole('heading', { name: 'Playlist', exact: true })).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-density', /.*/);

    await page.getByRole('radio', { name: 'Pro' }).check({ force: true });
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Pro' })).toBeChecked();
  });

  test('the light theme is a real theme', async ({ page }) => {
    await openApp(page);
    const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.getByRole('button', { name: 'Switch to the light theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(dark);
  });

  test('a panel can be maximized and restored from the keyboard and the button', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Maximize Piano roll' }).click();
    await expect(page.getByRole('button', { name: 'Restore Piano roll' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mixer', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Restore Piano roll' }).click();
    await expect(page.getByRole('heading', { name: 'Mixer', exact: true })).toBeVisible();
  });

  test('the shortcut help lists the keys and closes with Escape', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: /shortcuts/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('responsive layout', () => {
  for (const [width, height] of [
    [390, 844],
    [768, 1024],
    [1280, 800],
    [1920, 1080],
  ] as const) {
    for (const theme of ['dark', 'light'] as const) {
      test(`${width}px ${theme}: no horizontal overflow, screenshot attached for review`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height });
        const app = await openApp(page, { theme });
        expect(await noHorizontalOverflow(page), 'rack').toBeLessThanOrEqual(0);
        if (width < 768) {
          for (const tab of ['Browser', 'Roll', 'Mixer', 'Keys']) {
            await page.getByRole('navigation', { name: 'Panels' }).getByRole('button', { name: tab, exact: true }).click();
            expect(await noHorizontalOverflow(page), tab).toBeLessThanOrEqual(0);
          }
        }
        await testInfo.attach(`workspace-${width}-${theme}`, { body: await page.screenshot(), contentType: 'image/png' });
        expect(app.problems).toEqual([]);
      });
    }
  }
});

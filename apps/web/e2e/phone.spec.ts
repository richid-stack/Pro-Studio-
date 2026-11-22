import { expect, test, type Page } from '@playwright/test';
import { noHorizontalOverflow, openApp } from './helpers';

// Phone layout: one panel at a time with a bottom navigation, and everything reachable by touch.
// The phone projects (Pixel 7, iPhone 14) run only this file; the desktop projects run it at a phone size.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const nav = (page: Page) => page.getByRole('navigation', { name: 'Panels' });
const kickStep = (page: Page, n: number) => page.getByRole('button', { name: new RegExp(`^Kick, step ${n}(,|$)`) });

test.describe('on a phone', () => {
  test('every panel is one tap from the bottom navigation, fits the screen and logs no problems', async ({ page }) => {
    const app = await openApp(page);
    for (const tab of ['Browser', 'Rack', 'Roll', 'Playlist', 'Mixer', 'Keys']) {
      const button = nav(page).getByRole('button', { name: tab, exact: true });
      await button.tap();
      await expect(button).toHaveAttribute('aria-current', 'page');
      expect(await noHorizontalOverflow(page), tab).toBeLessThanOrEqual(0);
    }
    expect(app.problems).toEqual([]);
  });

  test('a tap on a step toggles it', async ({ page }) => {
    await openApp(page);
    await nav(page).getByRole('button', { name: 'Rack', exact: true }).tap();
    const step = kickStep(page, 2);
    await expect(step).toHaveAttribute('aria-pressed', 'false');
    await step.tap();
    await expect(step).toHaveAttribute('aria-pressed', 'true');
    await step.tap();
    await expect(step).toHaveAttribute('aria-pressed', 'false');
  });

  test('in the browser a tap selects a sound and the add button on its row adds it', async ({ page }) => {
    await openApp(page);
    await nav(page).getByRole('button', { name: 'Browser', exact: true }).tap();
    await page.getByRole('treeitem', { name: /^Rim,/ }).tap();
    await page.getByRole('button', { name: 'Add Rim to the project' }).tap();
    await nav(page).getByRole('button', { name: 'Rack', exact: true }).tap();
    await expect(page.getByText('8 channels')).toBeVisible();
  });

  test('on-screen keys play and release', async ({ page }) => {
    await openApp(page);
    await nav(page).getByRole('button', { name: 'Keys', exact: true }).tap();
    const key = page.getByRole('button', { name: 'E4', exact: true });
    const box = (await key.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 12);
    await page.mouse.down();
    await expect(key).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.up();
    await expect(key).toHaveAttribute('aria-pressed', 'false');
  });
});

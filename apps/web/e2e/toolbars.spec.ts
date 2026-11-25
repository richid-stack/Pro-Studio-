import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

test.describe('panel toolbars', () => {
  test('every panel carries its tools in its title bar', async ({ page }) => {
    const app = await openApp(page);
    for (const [panel, name] of [
      ['browser', 'Browser tools'],
      ['rack', 'Channel rack tools'],
      ['roll', 'Piano roll tools'],
      ['playlist', 'Playlist tools'],
      ['mixer', 'Mixer tools'],
    ] as const) {
      await expect(page.locator(`.workspace section.panel[data-panel="${panel}"] .panel-header`).getByRole('toolbar', { name })).toBeVisible();
    }
    expect(app.problems).toEqual([]);
  });

  test('Left and Right move between the tools in a toolbar', async ({ page }) => {
    await openApp(page);
    const roll = page.getByRole('toolbar', { name: 'Piano roll tools' });
    await roll.getByRole('button', { name: /^Draw/ }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(roll.getByRole('button', { name: /^Select/ })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(roll.getByRole('button', { name: /^Draw/ })).toBeFocused();
  });

  test('the lit tool is the active tool, by outline and by state', async ({ page }) => {
    await openApp(page);
    const roll = page.getByRole('toolbar', { name: 'Piano roll tools' });
    const draw = roll.getByRole('button', { name: /^Draw/ });
    const erase = roll.getByRole('button', { name: /^Erase/ });
    await expect(draw).toHaveAttribute('aria-pressed', 'true');
    await erase.click();
    await expect(erase).toHaveAttribute('aria-pressed', 'true');
    await expect(draw).toHaveAttribute('aria-pressed', 'false');
    // the eraser lights up in its own colour, not the draw colour
    const outline = (l: typeof erase): Promise<string> => l.evaluate((el) => getComputedStyle(el).outlineColor);
    expect(await outline(erase)).not.toBe(await outline(draw));
  });

  test('the mixer can unmute everything and clear solo, and each step is undoable', async ({ page }) => {
    await openApp(page);
    const mixer = page.locator('.mixer');
    const bar = page.getByRole('toolbar', { name: 'Mixer tools' });
    const unmute = bar.getByRole('button', { name: 'Unmute all' });
    const clear = bar.getByRole('button', { name: 'Clear solo' });
    await expect(unmute).toBeDisabled();
    await expect(clear).toBeDisabled();

    await mixer.getByRole('button', { name: 'Mute Kick' }).click();
    await mixer.getByRole('button', { name: 'Mute Snare' }).click();
    await mixer.getByRole('button', { name: 'Solo Hat' }).click();
    await expect(unmute).toBeEnabled();
    await expect(clear).toBeEnabled();

    await unmute.click();
    await expect(mixer.getByRole('button', { name: 'Mute Kick' })).toHaveAttribute('aria-pressed', 'false');
    await expect(mixer.getByRole('button', { name: 'Mute Snare' })).toHaveAttribute('aria-pressed', 'false');
    await expect(mixer.getByRole('button', { name: 'Solo Hat' })).toHaveAttribute('aria-pressed', 'true');
    await expect(unmute).toBeDisabled();

    await clear.click();
    await expect(mixer.getByRole('button', { name: 'Solo Hat' })).toHaveAttribute('aria-pressed', 'false');
    await expect(clear).toBeDisabled();

    await page.keyboard.press('Control+z');
    await expect(mixer.getByRole('button', { name: 'Solo Hat' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('the playlist tools are labelled previews: they light up and say they do nothing yet', async ({ page }) => {
    await openApp(page);
    const bar = page.getByRole('toolbar', { name: 'Playlist tools' });
    const tools = bar.locator('button.tool-btn');
    expect(await tools.count()).toBeGreaterThanOrEqual(6);
    for (const b of await tools.all()) {
      await expect(b).toHaveAttribute('data-preview', 'true');
      await expect(b).toHaveAttribute('title', /preview: does nothing yet/);
    }
    await bar.getByRole('button', { name: 'Paint clips' }).click();
    await expect(bar.getByRole('button', { name: 'Paint clips' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Paint clips is a preview and does nothing yet.')).toBeVisible();
  });

  test('Beginner puts words beside the icons; Standard keeps them as icons with tooltips', async ({ page }) => {
    await openApp(page, { mode: 'beginner' });
    await expect(page.getByRole('toolbar', { name: 'Piano roll tools' }).locator('.tool-text').first()).toBeVisible();
    await page.getByRole('radio', { name: 'Standard' }).check({ force: true });
    await expect(page.getByRole('toolbar', { name: 'Piano roll tools' }).locator('.tool-text')).toHaveCount(0);
  });

  test('a panel keeps its working toolbar when it floats', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Pop out Piano roll into a window' }).click();
    const roll = page.locator('section.fwin[data-panel="roll"]');
    const bar = roll.getByRole('toolbar', { name: 'Piano roll tools' });
    await expect(bar).toBeVisible();
    await bar.getByRole('button', { name: 'Erase' }).first().click();
    await expect(bar.getByRole('button', { name: /^Erase/ })).toHaveAttribute('aria-pressed', 'true');
    // and every tool is still inside the window: none is clipped past its right edge
    const box = await roll.boundingBox();
    for (const b of await bar.locator('button.tool-btn').all()) {
      const r = await b.boundingBox();
      if (r && box) expect(r.x + r.width).toBeLessThanOrEqual(box.x + box.width + 1);
    }
  });
});

import { expect, test } from '@playwright/test';
import { forceSave, notesOf, openApp, rollGeometry, selectChannel } from './helpers';

test.describe('files and export', () => {
  test('export writes a real WAV file', async ({ page }) => {
    const app = await openApp(page);
    await page.getByRole('button', { name: 'File' }).click();
    await page.getByRole('menuitem', { name: /Export audio/ }).click();
    await expect(page.getByRole('dialog', { name: 'Export audio' })).toBeVisible();
    const download = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: 'Export WAV' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.wav$/i);
    const stream = await file.createReadStream();
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c as Buffer);
    const bytes = Buffer.concat(chunks);
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(bytes.length).toBeGreaterThan(100_000);
    expect(app.problems).toEqual([]);
  });

  test('work survives a reload', async ({ page }) => {
    await openApp(page);
    await selectChannel(page, '808');
    await forceSave(page);
    const before = (await notesOf(page, '808')).length;
    const g = await rollGeometry(page);
    // a click on a free spot in the top row of the view draws one more note
    await page.mouse.click(g.x(30) + 3, g.box.y + g.rowH / 2);
    await expect.poll(async () => (await notesOf(page, '808')).length, { timeout: 5000 }).toBe(before + 1);
    await page.reload();
    await page.getByRole('heading', { name: 'Channel rack' }).waitFor();
    await selectChannel(page, '808');
    await expect(page.locator('ul[aria-label="Notes in this channel"] li')).toHaveCount(before + 1);
  });

  test('a starter beat can be loaded from the File menu and undone', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'File' }).click();
    await page.getByRole('menuitem', { name: /New drill beat/i }).click();
    await expect(page.getByRole('textbox', { name: 'Project name' })).toHaveValue(/drill/i);
    await page.keyboard.press('Control+z');
    await expect(page.getByRole('textbox', { name: 'Project name' })).toHaveValue(/trap/i);
  });
});

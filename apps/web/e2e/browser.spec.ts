import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers';

test.use({ viewport: { width: 1280, height: 800 } });

const peak = (page: Page) => page.evaluate(() => window.__peak());
const item = (page: Page, name: RegExp | string) => page.getByRole('treeitem', { name });
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('prostudio.browser.v1') ?? '{}') as { tab?: string; starred?: string[]; autoPreview?: boolean });

test.describe('browser tabs and tree', () => {
  test('shows the project, the sounds and the starter beats, and the tabs narrow it down', async ({ page }) => {
    const app = await openApp(page);
    const tabs = page.getByRole('tablist', { name: 'Browser sections' });
    await expect(tabs.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
    await expect(item(page, 'Current project')).toBeVisible();
    await expect(item(page, 'Sounds')).toBeVisible();
    await expect(item(page, 'Starter beats')).toBeVisible();

    await tabs.getByRole('tab', { name: 'Project' }).click();
    await expect(item(page, 'Current project')).toBeVisible();
    await expect(item(page, 'Sounds')).toHaveCount(0);

    await tabs.getByRole('tab', { name: 'Sounds' }).click();
    await expect(item(page, 'Drums')).toBeVisible();
    await expect(item(page, 'Instruments')).toBeVisible();
    await expect(item(page, 'Current project')).toHaveCount(0);
    expect(app.problems).toEqual([]);
  });

  test('the tabs follow the arrow keys and remember the choice', async ({ page }) => {
    await openApp(page);
    const tabs = page.getByRole('tablist', { name: 'Browser sections' });
    await tabs.getByRole('tab', { name: 'All' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.getByRole('tab', { name: 'Project' })).toBeFocused();
    await page.keyboard.press('End');
    await expect(tabs.getByRole('tab', { name: 'Starred' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.getByRole('tab', { name: 'All' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(tabs.getByRole('tab', { name: 'Starred' })).toHaveAttribute('aria-selected', 'true');
    await page.reload();
    await page.getByRole('heading', { name: 'Channel rack' }).waitFor();
    await expect(page.getByRole('tab', { name: 'Starred' })).toHaveAttribute('aria-selected', 'true');
  });

  test('folders open and close with the arrow keys and a click, and keep the count of what is inside', async ({ page }) => {
    await openApp(page);
    const drums = item(page, 'Drums');
    await expect(drums).toHaveAttribute('aria-expanded', 'true');
    await expect(drums).toContainText('6');
    await drums.click();
    await expect(drums).toHaveAttribute('aria-expanded', 'false');
    await expect(item(page, /^Rim,/)).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect(drums).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(item(page, /^Kick, Round/)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(drums).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Collapse all folders' }).click();
    await expect(item(page, 'Sounds')).toHaveAttribute('aria-expanded', 'false');
    await expect(item(page, 'Current project')).toHaveAttribute('aria-expanded', 'false');
  });

  test('the arrow keys walk the rows, Home and End jump, and a letter jumps to a name', async ({ page }) => {
    await openApp(page);
    // a channel row (not a folder, which a click would close)
    await item(page, /^Kick, 7 hits/).click();
    await page.keyboard.press('ArrowDown');
    await expect(item(page, /^Snare, 2 hits/)).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.locator('[role=treeitem]').last()).toBeFocused();
    await page.keyboard.press('Home');
    await expect(item(page, 'Current project')).toBeFocused();
    await page.keyboard.press('o');
    await expect(item(page, /^Open hat, 3 hits/)).toBeFocused();
  });

  test('typing a letter in the tree never plays the piano', async ({ page }) => {
    await openApp(page, { mode: 'standard' });
    await page.getByRole('button', { name: 'Preview sounds when selected' }).click();
    await item(page, 'Current project').click();
    await page.keyboard.press('z');
    await page.keyboard.press('x');
    await page.waitForTimeout(400);
    expect(await peak(page)).toBeLessThan(0.002);
  });
});

test.describe('search and tags', () => {
  test('search narrows the tree, opens the folders that hold a match and can be cleared', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Collapse all folders' }).click();
    const search = page.getByRole('searchbox', { name: 'Search the browser' });
    await search.fill('bass');
    await expect(item(page, /^808 sub,/)).toBeVisible();
    await expect(item(page, /^Snare/)).toHaveCount(0);
    await search.fill('snr zzz');
    await expect(page.getByText(/Nothing matches/)).toBeVisible();
    await search.press('Escape');
    await expect(search).toHaveValue('');
    await expect(item(page, 'Current project')).toBeVisible();
    await search.fill('rim');
    await page.getByRole('button', { name: 'Clear the search' }).click();
    await expect(search).toHaveValue('');
  });

  test('the down arrow moves from the search box into the tree', async ({ page }) => {
    await openApp(page);
    await page.getByRole('searchbox', { name: 'Search the browser' }).fill('hat');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[role=treeitem][tabindex="0"]')).toBeFocused();
  });

  test('tag chips filter, can be combined and are offered only in Standard and Pro', async ({ page }) => {
    await openApp(page, { mode: 'standard' });
    const hats = page.getByRole('button', { name: 'hats', exact: true });
    await hats.click();
    await expect(hats).toHaveAttribute('aria-pressed', 'true');
    await expect(item(page, /^Closed hat,/)).toBeVisible();
    await expect(item(page, /^Kick, Round/)).toHaveCount(0);
    await page.getByRole('button', { name: 'bright', exact: true }).click();
    await expect(item(page, /^Closed hat,/)).toBeVisible();
    await page.getByRole('button', { name: 'warm', exact: true }).click();
    await expect(page.getByText(/Nothing matches/)).toBeVisible();
  });

  test('Beginner gets a how-to line and no tag chips', async ({ page }) => {
    await openApp(page, { mode: 'beginner' });
    await expect(page.getByText(/Double-click it, or press Enter, to add it/)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Filter by tag' })).toHaveCount(0);
  });
});

test.describe('previewing and adding', () => {
  test('clicking a sound plays it, and the speaker button turns that off', async ({ page }) => {
    await openApp(page);
    await item(page, /^Snare, Three/).click();
    await expect.poll(() => peak(page), { timeout: 8000 }).toBeGreaterThan(0.01);
    await expect.poll(() => peak(page), { timeout: 10_000 }).toBeLessThan(0.002);
    await page.getByRole('button', { name: 'Preview sounds when selected' }).click();
    expect((await stored(page)).autoPreview).toBe(false);
    await item(page, /^Clap, Layered/).click();
    await page.waitForTimeout(500);
    expect(await peak(page)).toBeLessThan(0.002);
    // the row's own preview button still works
    await page.getByRole('button', { name: 'Preview Clap' }).click();
    await expect.poll(() => peak(page), { timeout: 8000 }).toBeGreaterThan(0.01);
  });

  test('Space previews the focused sound', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Preview sounds when selected' }).click();
    await item(page, /^Snare, Three/).click();
    await page.keyboard.press(' ');
    await expect.poll(() => peak(page), { timeout: 8000 }).toBeGreaterThan(0.01);
  });

  test('Enter adds the sound as a channel, selects it, and undo takes it away', async ({ page }) => {
    await openApp(page);
    await item(page, /^Pluck,/).click();
    await page.keyboard.press('Enter');
    await expect(page.locator('.rack-row, .rack-inst').filter({ hasText: 'Pluck' }).first()).toBeVisible();
    await expect(page.getByText('8 channels')).toBeVisible();
    await page.keyboard.press('Control+z');
    await expect(page.getByText('7 channels')).toBeVisible();
  });

  test('double-click adds a sound, and so does the add button on its row', async ({ page }) => {
    await openApp(page);
    await item(page, /^Rim,/).dblclick();
    await expect(page.getByText('8 channels')).toBeVisible();
    await item(page, /^Pad,/).hover();
    await page.getByRole('button', { name: 'Add Pad to the project' }).click();
    await expect(page.getByText('9 channels')).toBeVisible();
  });

  test('a sound can be dragged onto the channel rack', async ({ page }) => {
    await openApp(page);
    await item(page, /^Rim,/).dragTo(page.locator('.rack'));
    await expect(page.getByText('8 channels')).toBeVisible();
    await expect(page.locator('.rack[data-dropping]')).toHaveCount(0);
  });

  test('choosing a channel in the project folder selects it', async ({ page }) => {
    await openApp(page);
    await item(page, /^808, \d+ notes/).click();
    await expect(item(page, /^808, \d+ notes/)).toHaveAttribute('aria-current', 'true');
    await item(page, /^Keys, \d+ notes/).click();
    await expect(item(page, /^Keys, \d+ notes/)).toHaveAttribute('aria-current', 'true');
    await expect(item(page, /^808, \d+ notes/)).not.toHaveAttribute('aria-current', 'true');
  });

  test('a starter beat replaces the project, and undo brings it back', async ({ page }) => {
    await openApp(page);
    const name = page.getByRole('textbox', { name: 'Project name' });
    const before = await name.inputValue();
    await item(page, 'Starter beats').click();
    await item(page, /^Drill,/).click();
    await page.keyboard.press('Enter');
    await expect(name).toHaveValue(/drill/i);
    await page.keyboard.press('Control+z');
    await expect(name).toHaveValue(before);
  });
});

test.describe('stars', () => {
  test('Alt+S stars a sound, the Starred tab lists it, and the star survives a reload', async ({ page }) => {
    await openApp(page);
    await page.getByRole('tab', { name: 'Starred' }).click();
    await expect(page.getByText(/Nothing starred yet/)).toBeVisible();
    await page.getByRole('tab', { name: 'All' }).click();
    await item(page, /^Open hat, Long shimmer/).click();
    await page.keyboard.press('Alt+s');
    await expect(page.getByRole('button', { name: 'Remove the star from Open hat' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await stored(page)).starred).toEqual(['drum:ohat']);
    await page.reload();
    await page.getByRole('heading', { name: 'Channel rack' }).waitFor();
    await page.getByRole('tab', { name: 'Starred' }).click();
    await expect(item(page, 'Starred')).toContainText('1');
    await expect(item(page, /^Open hat, Long shimmer/)).toBeVisible();
    await expect(item(page, /^Kick,/)).toHaveCount(0);
  });

  test('the star button on a row stars and unstars, and starter beats can be starred', async ({ page }) => {
    await openApp(page);
    await item(page, 'Starter beats').click();
    await item(page, /^Afrobeat,/).hover();
    await page.getByRole('button', { name: 'Star Afrobeat' }).click();
    await page.getByRole('tab', { name: 'Starred' }).click();
    await expect(item(page, /^Afrobeat,/)).toBeVisible();
    await item(page, /^Afrobeat,/).hover();
    await page.getByRole('button', { name: 'Remove the star from Afrobeat' }).click();
    await expect(page.getByText(/Nothing starred yet/)).toBeVisible();
  });

  test('channels of the project cannot be starred', async ({ page }) => {
    await openApp(page);
    await item(page, /^Kick, 7 hits/).click();
    await page.keyboard.press('Alt+s');
    expect((await stored(page)).starred ?? []).toEqual([]);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the browser fits the screen and a tap adds a sound with the add button', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Browser', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await item(page, /^Rim,/).tap();
    await page.getByRole('button', { name: 'Add Rim to the project' }).tap();
    await page.getByRole('button', { name: 'Rack', exact: true }).tap();
    await expect(page.getByText('8 channels')).toBeVisible();
  });
});

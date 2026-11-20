import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __peak: () => number;
    __ctx?: AudioContext;
  }
}

/**
 * Taps whatever is connected to the audio destination with an analyser, so tests can assert that sound is
 * actually produced and that it stops after release, without touching product code.
 */
async function tapAudio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const connect = AudioNode.prototype.connect as (this: AudioNode, ...args: unknown[]) => unknown;
    let tapped: AnalyserNode | undefined;
    (AudioNode.prototype as unknown as { connect: unknown }).connect = function (this: AudioNode, dest: unknown, ...rest: unknown[]) {
      const result = connect.call(this, dest, ...rest);
      if (dest instanceof AudioDestinationNode && !tapped) {
        tapped = this.context.createAnalyser();
        tapped.fftSize = 2048;
        connect.call(this, tapped);
        window.__ctx = this.context as AudioContext;
      }
      return result;
    };
    window.__peak = () => {
      if (!tapped) return -1;
      const buf = new Float32Array(tapped.fftSize);
      tapped.getFloatTimeDomainData(buf);
      return buf.reduce((p, x) => Math.max(p, Math.abs(x)), 0);
    };
  });
}

async function openApp(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()}`));
  await tapAudio(page);
  // Relative, so the tests also work when the app is served under a sub-path (see playwright.config.ts).
  await page.goto('./');
  await page.locator('.piano').waitFor();

  const key = (name: string) => page.locator(`.piano button[aria-label="${name}"]`);
  return {
    problems,
    key,
    pressed: async (name: string) => (await key(name).getAttribute('aria-pressed')) === 'true',
    playing: async () => (await page.locator('.playing .t-num').innerText()).trim(),
    choose: (label: string) => page.getByText(label, { exact: true }).click(),
  };
}

test.describe('laptop keyboard piano', () => {
  test('plays notes with real sound and stops on release', async ({ page }) => {
    const app = await openApp(page);
    await expect(page.getByRole('status')).toContainText('first note');

    await page.keyboard.down('a');
    await expect.poll(() => page.evaluate(() => window.__peak())).toBeGreaterThan(0.01);
    expect(await app.pressed('C4')).toBe(true);
    expect(await app.playing()).toBe('C4');
    expect(await page.evaluate(() => window.__ctx?.state)).toBe('running');
    await expect(page.getByRole('status')).toContainText('Sound is on');

    await page.keyboard.up('a');
    expect(await app.pressed('C4')).toBe(false);
    await expect.poll(() => page.evaluate(() => window.__peak()), { timeout: 4000 }).toBeLessThan(0.002);
    expect(app.problems).toEqual([]);
  });

  test('names the chord you are holding', async ({ page }) => {
    const app = await openApp(page);
    for (const k of ['a', 'd', 'g']) await page.keyboard.down(k);
    expect(await app.playing()).toBe('C');
  });

  test('octave keys move the keyboard and held notes still release', async ({ page }) => {
    const app = await openApp(page);
    await page.keyboard.press('x');
    await page.keyboard.down('w');
    expect(await app.pressed('C#5')).toBe(true);
    await page.keyboard.up('w');
    await page.keyboard.press('z');

    await page.keyboard.down('a');
    await page.keyboard.press('x');
    await page.keyboard.up('a');
    expect(await app.playing()).toBe('—');
  });

  test('browser shortcuts and window blur do not leave notes stuck', async ({ page }) => {
    const app = await openApp(page);
    await page.keyboard.down('Control');
    await page.keyboard.down('a');
    expect(await app.pressed('C4')).toBe(false);
    await page.keyboard.up('a');
    await page.keyboard.up('Control');

    await page.keyboard.down('a');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    expect(await app.pressed('C4')).toBe(false);
  });

  test('on-screen keys respond to the pointer', async ({ page }) => {
    const app = await openApp(page);
    const box = await app.key('E4').boundingBox();
    if (!box) throw new Error('E4 key not found');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 12);
    await page.mouse.down();
    expect(await app.pressed('E4')).toBe(true);
    await page.mouse.up();
    expect(await app.pressed('E4')).toBe(false);
  });

  test('two-row layout reaches a second octave', async ({ page }) => {
    const app = await openApp(page);
    await app.choose('Two rows');
    await page.keyboard.down('z');
    expect(await app.pressed('C4')).toBe(true);
    await page.keyboard.up('z');
    await page.keyboard.down('q');
    expect(await app.pressed('C5')).toBe(true);
    await page.keyboard.up('q');
    await expect(app.key('C6')).toHaveCount(1);
  });

  test('the 808 and pluck presets make sound', async ({ page }) => {
    const app = await openApp(page);
    for (const preset of ['808', 'Pluck']) {
      await app.choose(preset);
      await page.keyboard.down('a');
      await expect.poll(() => page.evaluate(() => window.__peak())).toBeGreaterThan(0.01);
      await page.keyboard.up('a');
      await page.waitForTimeout(800);
    }
  });
});

test.describe('experience modes', () => {
  test('modes change what is shown and the defaults, and the choice persists', async ({ page }) => {
    const app = await openApp(page);
    await expect(page.locator('h1')).toHaveText('Standard mode');
    await expect(page.locator('html')).not.toHaveAttribute('data-density', /.*/);

    await app.choose('Beginner');
    await expect(page.locator('h1')).toHaveText('Beginner mode');
    await expect(page.getByText('How to play')).toBeVisible();
    await expect(page.getByText('Loudness', { exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'comfortable');
    await expect(page.locator('table.numeric')).toHaveCount(0);

    await app.choose('Pro');
    await expect(page.getByText('How to play')).toHaveCount(0);
    await expect(page.getByText('Velocity', { exact: true })).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-density', /.*/);
    await page.keyboard.down('a');
    await expect(page.locator('table.numeric tbody tr').first()).toContainText('261.63');
    await page.keyboard.up('a');

    await page.reload();
    await expect(page.locator('h1')).toHaveText('Pro mode');
  });

  test('the light theme is a real theme', async ({ page }) => {
    const app = await openApp(page);
    const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await app.choose('Light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(light).not.toBe(dark);
  });
});

test.describe('responsive layout', () => {
  for (const [width, height] of [
    [390, 844],
    [768, 1024],
    [1280, 800],
    [1920, 1080],
  ] as const) {
    test(`no horizontal overflow at ${width}px, and a screenshot is attached for review`, async ({ page }, testInfo) => {
      const app = await openApp(page);
      await page.setViewportSize({ width, height });
      for (const layout of ['Home row', 'Two rows']) {
        await app.choose(layout);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${layout} at ${width}px`).toBeLessThanOrEqual(0);
      }
      await testInfo.attach(`standard-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
      expect(app.problems).toEqual([]);
    });
  }
});

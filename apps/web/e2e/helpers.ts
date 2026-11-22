import { expect, type Page } from '@playwright/test';

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

export type Mode = 'beginner' | 'standard' | 'pro';

export interface Note {
  id: number;
  t: number;
  d: number;
  n: number;
  v: number;
  s: boolean;
}

/** Open the app with a clean slate: a chosen mode and theme, every console problem collected. */
export async function openApp(page: Page, opts: { mode?: Mode; theme?: 'dark' | 'light' } = {}) {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()}`));
  await tapAudio(page);
  // Seed the preferences once per tab, so a reload inside a test keeps whatever the test changed.
  await page.addInitScript(
    ({ mode, theme }) => {
      try {
        if (!sessionStorage.getItem('e2e-seeded')) {
          localStorage.clear();
          localStorage.setItem('prostudio.preferences.v1', JSON.stringify({ mode, theme, density: 'auto' }));
          sessionStorage.setItem('e2e-seeded', '1');
        }
      } catch {
        /* storage blocked: the app falls back to its defaults */
      }
    },
    { mode: opts.mode ?? 'standard', theme: opts.theme ?? 'dark' },
  );
  // Relative, so the tests also work when the app is served under a sub-path (see playwright.config.ts).
  await page.goto('./');
  await page.getByRole('heading', { name: 'Channel rack' }).waitFor();
  return { problems };
}

/** The project as last saved. The app saves 400 ms after a change. */
export async function savedProject(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('prostudio.project.v1');
    return raw ? (JSON.parse(raw) as { name: string; bars: number; channels: Array<{ id: string; name: string; type: string; notes?: Note[]; v?: number[]; mix: { mute: boolean; db: number } }> }) : null;
  });
}

/**
 * The app saves only after a change. Make one and undo it: the saved copy is then the project as it was, and the
 * history is back where it started.
 */
export async function forceSave(page: Page): Promise<void> {
  await page.locator('.rack-row .led').first().click();
  await page.keyboard.press('Control+z');
  await expect.poll(() => savedProject(page)).not.toBeNull();
}

export async function notesOf(page: Page, channelName: string): Promise<Note[]> {
  const p = await savedProject(page);
  return p?.channels.find((c) => c.name === channelName)?.notes ?? [];
}

/** Wait for the saved notes of a channel to satisfy a condition (the save is debounced). */
export async function expectNotes(page: Page, channelName: string, check: (notes: Note[]) => boolean, message: string): Promise<Note[]> {
  await expect.poll(async () => check(await notesOf(page, channelName)), { message, timeout: 5000 }).toBe(true);
  return notesOf(page, channelName);
}

/** Select a channel by clicking its name in the rack. */
export async function selectChannel(page: Page, name: string): Promise<void> {
  await page.locator('.rack-row').filter({ has: page.getByRole('button', { name, exact: true }) }).getByRole('button', { name, exact: true }).click();
}

/** The piano roll's current view, read from the data attributes the roll keeps on its drawing surface. */
export async function rollGeometry(page: Page) {
  const view = page.locator('.roll-view');
  const box = await view.boundingBox();
  if (!box) throw new Error('The piano roll is not on screen');
  const d = await view.evaluate((el) => ({ stepW: Number((el as HTMLElement).dataset.stepW), rowH: Number((el as HTMLElement).dataset.rowH), sx: Number((el as HTMLElement).dataset.scrollX), sy: Number((el as HTMLElement).dataset.scrollY) }));
  return { box, ...d, x: (step: number) => box.x + step * d.stepW - d.sx, y: (pitch: number) => box.y + (108 - pitch) * d.rowH - d.sy };
}

export async function noHorizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

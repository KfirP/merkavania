import { expect, type Page } from '@playwright/test';

export function isSceneActive(page: Page, key: string) {
  return page.evaluate((k) => window.__merkavania?.game.scene.isActive(k) ?? false, key);
}

export async function getPawn(page: Page) {
  const pawn = await page.evaluate(() => window.__merkavania?.getPawn() ?? null);
  if (!pawn) throw new Error('No pawn telemetry yet');
  return pawn;
}

export function getShots(page: Page) {
  return page.evaluate(() => window.__merkavania?.getShots() ?? {});
}

/** Collects console errors and uncaught exceptions; assert it's empty at the end of a test. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

/** Boots with the debug hooks, leaves the title with a key press and waits for the first frame. */
export async function enterWorld(page: Page) {
  await page.goto('/?debug=1');
  await expect.poll(() => isSceneActive(page, 'Title')).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => isSceneActive(page, 'World')).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__merkavania?.getPawn() != null)).toBe(true);
}

/** Page coordinates for a point given as fractions (0..1) of the canvas. */
export async function canvasPoint(page: Page, fx: number, fy: number) {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('No canvas');
  return { x: box.x + box.width * fx, y: box.y + box.height * fy };
}

/** Holds a key for `ms` and returns the pawn telemetry sampled just before release. */
export async function holdKey(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  const pawn = await getPawn(page);
  await page.keyboard.up(key);
  return pawn;
}

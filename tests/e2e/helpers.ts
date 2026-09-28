import { expect, type Page } from '@playwright/test';

export function isSceneActive(page: Page, key: string) {
  return page.evaluate((k) => window.__merkavania?.game.scene.isActive(k) ?? false, key);
}

export async function getPawn(page: Page) {
  const pawn = await page.evaluate(() => window.__merkavania?.getPawn() ?? null);
  if (!pawn) throw new Error('No pawn telemetry yet');
  return pawn;
}

export async function getWorld(page: Page) {
  const world = await page.evaluate(() => window.__merkavania?.getWorld() ?? null);
  if (!world) throw new Error('No world state yet');
  return world;
}

/** Moves the pawn (debug hook), waits for a frame at the new spot, and returns its telemetry. */
export async function teleport(page: Page, x: number, y: number, heading?: number) {
  await page.evaluate(([x, y, h]) => window.__merkavania?.teleport(x!, y!, h), [x, y, heading]);
  await expect
    .poll(async () => {
      const p = await getPawn(page);
      return Math.hypot(p.x - x, p.y - y) < 1 && p.speed === 0;
    })
    .toBe(true);
  return getPawn(page);
}

export function damagePlayer(page: Page, amount: number) {
  return page.evaluate((n) => window.__merkavania?.damagePlayer(n), amount);
}

export function setGod(page: Page, on: boolean) {
  return page.evaluate((v) => window.__merkavania?.setGod(v), on);
}

export function getCombatLog(page: Page) {
  return page.evaluate(() => window.__merkavania?.getCombatLog() ?? []);
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

/**
 * Moves the mouse over world point (x, y) and waits until the turret points at it. Waits for the
 * camera (which follows with lerp) to settle first, or the point would drift under the mouse.
 */
export async function aimAt(page: Page, x: number, y: number) {
  const toCanvas = () =>
    page.evaluate(([x, y]) => window.__merkavania!.worldToCanvas(x!, y!), [x, y]);
  let f = await toCanvas();
  await expect
    .poll(async () => {
      const prev = f;
      f = await toCanvas();
      return Math.abs(f.fx - prev.fx) + Math.abs(f.fy - prev.fy) < 1e-4;
    })
    .toBe(true);
  const p = await canvasPoint(page, f.fx, f.fy);
  await page.mouse.move(p.x, p.y);
  await expect
    .poll(async () => {
      const pawn = await getPawn(page);
      const want = Math.atan2(y - pawn.y, x - pawn.x);
      return Math.abs(
        Math.atan2(Math.sin(want - pawn.turretAngle), Math.cos(want - pawn.turretAngle)),
      );
    })
    .toBeLessThan(0.05);
}

export function getDestructibles(page: Page) {
  return page.evaluate(() => window.__merkavania?.getDestructibles() ?? []);
}

/** Holds a key for `ms` and returns the pawn telemetry sampled just before release. */
export async function holdKey(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  const pawn = await getPawn(page);
  await page.keyboard.up(key);
  return pawn;
}

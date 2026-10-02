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
 * Keeps the mouse over world point (x, y) until the turret points at it. The camera follows with
 * lerp, so the point drifts across the canvas for a while after a teleport: every poll moves the
 * mouse back onto it.
 */
export async function aimAt(page: Page, x: number, y: number) {
  await expect
    .poll(
      async () => {
        const f = await page.evaluate(
          ([x, y]) => window.__merkavania!.worldToCanvas(x!, y!),
          [x, y],
        );
        const p = await canvasPoint(page, f.fx, f.fy);
        await page.mouse.move(p.x, p.y);
        const pawn = await getPawn(page);
        const want = Math.atan2(y - pawn.y, x - pawn.x);
        return Math.abs(
          Math.atan2(Math.sin(want - pawn.turretAngle), Math.cos(want - pawn.turretAngle)),
        );
      },
      { timeout: 10_000 },
    )
    .toBeLessThan(0.05);
}

export function getEnemies(page: Page) {
  return page.evaluate(() => window.__merkavania?.getEnemies() ?? []);
}

/** Spawns an enemy (a whole squad for `rifle_squad`); `facing` in radians. */
export function spawnEnemy(page: Page, type: string, x: number, y: number, facing = 0) {
  return page.evaluate(
    ([type, x, y, facing]) =>
      window.__merkavania?.spawnEnemy(type as string, x as number, y as number, facing as number),
    [type, x, y, facing] as const,
  );
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

/** The GameState as of the last frame, in save shape. */
export async function getState(page: Page) {
  const state = await page.evaluate(() => window.__merkavania?.getState() ?? null);
  if (!state) throw new Error('No game state yet');
  return state;
}

export function getObjects(page: Page) {
  return page.evaluate(() => window.__merkavania!.getObjects());
}

export function grantAbility(page: Page, ability: string) {
  return page.evaluate((a) => window.__merkavania?.grantAbility(a as never), ability);
}

export function getSave(page: Page, slot = 1) {
  return page.evaluate((s) => window.__merkavania?.getSave(s) ?? null, slot);
}

export function getMortarLandings(page: Page) {
  return page.evaluate(() => window.__merkavania?.getMortarLandings() ?? []);
}

/** Moves the mouse onto world point (x, y) once the camera has settled (via `aimAt`). */
export async function pointMouseAt(page: Page, x: number, y: number) {
  await aimAt(page, x, y);
  const f = await page.evaluate(([x, y]) => window.__merkavania!.worldToCanvas(x!, y!), [x, y]);
  const p = await canvasPoint(page, f.fx, f.fy);
  await page.mouse.move(p.x, p.y);
}

/** The tank's telemetry, whichever pawn is active. */
export async function getTank(page: Page) {
  const tank = await page.evaluate(() => window.__merkavania?.getTank() ?? null);
  if (!tank) throw new Error('No tank telemetry yet');
  return tank;
}

export function damageScout(page: Page, amount: number) {
  return page.evaluate((n) => window.__merkavania?.damageScout(n), amount);
}

/** Presses a key for a few frames: input is polled once per frame, so a same-frame tap is lost. */
export async function tapKey(page: Page, key: string) {
  await page.keyboard.down(key);
  await page.waitForTimeout(100);
  await page.keyboard.up(key);
}

/** Holds `key` until `done` holds for the active pawn (or the timeout), then releases it. */
export async function walkUntil(
  page: Page,
  key: string,
  done: (pawn: Awaited<ReturnType<typeof getPawn>>) => boolean,
  timeout = 5_000,
) {
  await page.keyboard.down(key);
  try {
    // Poll every frame or so: the default backoff would let the pawn overshoot.
    await expect
      .poll(async () => done(await getPawn(page)), { timeout, intervals: [16] })
      .toBe(true);
  } finally {
    await page.keyboard.up(key);
  }
}

/** The open menu in scene `scene` (rows, focus, where each row is), or null. */
export function getMenu(page: Page, scene: string) {
  return page.evaluate((s) => window.__merkavania?.getMenu(s) ?? null, scene);
}

/** Presses a key (by DOM key name, e.g. `ArrowDown`) and gives the game a couple of frames. */
export async function pressKey(page: Page, key: string) {
  await page.keyboard.press(key);
  await page.waitForTimeout(80);
}

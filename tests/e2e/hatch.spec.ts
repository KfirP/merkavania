import { expect, test } from '@playwright/test';
import {
  collectErrors,
  damageScout,
  enterWorld,
  getObjects,
  getPawn,
  getState,
  getTank,
  grantAbility,
  holdKey,
  tapKey,
  teleport,
  walkUntil,
} from './helpers';

/**
 * The M5 corner, test_x03_y02 (origin 1440, 544). Open ground west of x 1728. A wall block at
 * x 1728..1776 (y 560..688) has a crawlspace through it on y 608..624, leading into a pocket
 * (x 1776..1904, y 560..672) with the scout switch at (1800, 584) and an armor plate at
 * (1864, 600). The pocket's door fills x 1808..1872, y 672..688. The hatch pickup is at (1496, 744).
 */
const WEST = Math.PI;
const CRAWL_Y = 616;
/** Facing west next to the wall block, so the scout climbs out east, in front of the crawlspace. */
const BY_THE_WALL = { x: 1696, y: CRAWL_Y };
const OPEN = { x: 1560, y: 760 };
const LEASH = 400;

async function deploy(page: Parameters<typeof getPawn>[0]) {
  await tapKey(page, 'f');
  await expect.poll(async () => (await getPawn(page)).kind).toBe('scout');
}

test.describe('rear hatch', () => {
  test('the hatch stays shut without the scout, and while the tank is moving', async ({ page }) => {
    const errors = collectErrors(page);
    await enterWorld(page);
    await teleport(page, OPEN.x, OPEN.y, WEST);
    await tapKey(page, 'f');
    await page.waitForTimeout(300);
    expect((await getPawn(page)).kind).toBe('tank');

    await grantAbility(page, 'hatch_scout');
    await page.keyboard.down('w');
    await page.waitForTimeout(500);
    await tapKey(page, 'f');
    await page.keyboard.up('w');
    await page.waitForTimeout(300);
    expect((await getPawn(page)).kind).toBe('tank');
    expect(errors).toEqual([]);
  });

  test('driving over the hatch pickup grants the scout', async ({ page }) => {
    await enterWorld(page);
    await teleport(page, 1460, 744, 0);
    await holdKey(page, 'w', 900);
    await expect.poll(async () => (await getState(page)).abilities).toContain('hatch_scout');
  });

  test('the scout climbs out behind the tank, crawls through, and flips the switch that opens the door', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await enterWorld(page);
    await grantAbility(page, 'hatch_scout');
    await teleport(page, BY_THE_WALL.x, BY_THE_WALL.y, WEST);
    // The tank can't use the crawlspace.
    await teleport(page, BY_THE_WALL.x, BY_THE_WALL.y, 0);
    const blocked = await holdKey(page, 'w', 1_200);
    expect(blocked.x).toBeLessThan(1728);
    await teleport(page, BY_THE_WALL.x, BY_THE_WALL.y, WEST);

    await deploy(page);
    const scout = await getPawn(page);
    const tank = await getTank(page);
    // Out of the rear: east of a tank facing west.
    expect(scout.x).toBeGreaterThan(tank.x + 10);
    expect(Math.abs(scout.y - tank.y)).toBeLessThan(2);

    // Through the crawlspace to the switch's column, then up onto it.
    await walkUntil(page, 'd', (p) => p.x > 1796);
    await page.keyboard.down('w');
    await expect
      .poll(async () => (await getObjects(page)).switches.find((s) => s.activatedBy === 'scout'))
      .toMatchObject({ activated: true });
    await page.keyboard.up('w');
    await expect
      .poll(async () => (await getObjects(page)).doors.map((d) => d.key))
      .not.toContain('test_x03_y02:door_scout');
    expect((await getState(page)).flags).toHaveProperty('test_x03_y02:sw_scout');

    // The tank held still the whole time.
    const after = await getTank(page);
    expect(Math.hypot(after.x - tank.x, after.y - tank.y)).toBeLessThan(1);
    expect(errors).toEqual([]);
  });

  test('a recalled scout walks itself back through the crawlspace and boards', async ({ page }) => {
    await enterWorld(page);
    await grantAbility(page, 'hatch_scout');
    await teleport(page, BY_THE_WALL.x, BY_THE_WALL.y, WEST);
    await deploy(page);
    await walkUntil(page, 'd', (p) => p.x > 1800);
    await tapKey(page, 'f');
    await expect.poll(async () => (await getPawn(page)).kind, { timeout: 8_000 }).toBe('tank');
    expect((await getPawn(page)).x).toBeCloseTo(BY_THE_WALL.x, 0);
  });

  test('walking back into the tank boards it', async ({ page }) => {
    await enterWorld(page);
    await grantAbility(page, 'hatch_scout');
    await teleport(page, OPEN.x, OPEN.y, WEST);
    await deploy(page);
    // Climbing out doesn't board straight back in.
    await page.waitForTimeout(300);
    expect((await getPawn(page)).kind).toBe('scout');
    await walkUntil(page, 'd', (p) => p.x > OPEN.x + 60);
    await walkUntil(page, 'a', (p) => p.kind === 'tank');
  });

  test('the scout stays on its leash around the tank', async ({ page }) => {
    await enterWorld(page);
    await grantAbility(page, 'hatch_scout');
    await teleport(page, OPEN.x, OPEN.y, WEST);
    await deploy(page);
    const tank = await getTank(page);
    // Far beyond the leash: pulled back onto it.
    await page.evaluate(([x, y]) => window.__merkavania!.teleport(x!, y!), [tank.x - 600, tank.y]);
    await expect
      .poll(async () => {
        const p = await getPawn(page);
        return Math.hypot(p.x - tank.x, p.y - tank.y);
      })
      .toBeLessThanOrEqual(LEASH + 1);
    // Walking away doesn't stretch it.
    await holdKey(page, 'a', 800);
    const p = await getPawn(page);
    expect(Math.hypot(p.x - tank.x, p.y - tank.y)).toBeLessThanOrEqual(LEASH + 1);
  });

  test('a downed scout hands control back to the tank', async ({ page }) => {
    const errors = collectErrors(page);
    await enterWorld(page);
    await grantAbility(page, 'hatch_scout');
    await teleport(page, OPEN.x, OPEN.y, WEST);
    await deploy(page);
    await damageScout(page, 1_000);
    await expect.poll(async () => (await getPawn(page)).kind).toBe('tank');
    expect((await getPawn(page)).alive).toBe(true);
    // The hatch stays shut for a moment, then opens again.
    await tapKey(page, 'f');
    await page.waitForTimeout(200);
    expect((await getPawn(page)).kind).toBe('tank');
    await page.waitForTimeout(1_500);
    await deploy(page);
    expect(errors).toEqual([]);
  });

  test('enemies shoot at the scout when it is the one they can see', async ({ page }) => {
    await enterWorld(page);
    await grantAbility(page, 'hatch_scout');
    await teleport(page, OPEN.x, OPEN.y, WEST);
    await deploy(page);
    const scout = await getPawn(page);
    // A squad east of the scout; the tank is further away to the west.
    await page.evaluate(
      ([x, y]) => window.__merkavania!.spawnEnemy('rifle_squad', x!, y!, Math.PI),
      [scout.x + 90, scout.y],
    );
    await expect
      .poll(() => page.evaluate(() => window.__merkavania!.getCombatLog().map((h) => h.target)), {
        timeout: 8_000,
      })
      .toContain('scout');
  });
});

import { expect, test } from '@playwright/test';
import {
  canvasPoint,
  collectErrors,
  enterWorld,
  getPawn,
  getShots,
  holdKey,
  isSceneActive,
} from './helpers';

test.describe('Mk2 tank on keyboard and mouse', () => {
  test('the click that leaves the title does not fire', async ({ page }) => {
    await page.goto('/?debug=1');
    await expect.poll(() => isSceneActive(page, 'Title')).toBe(true);
    const p = await canvasPoint(page, 0.5, 0.5);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down({ button: 'right' });
    await page.mouse.down();
    await expect.poll(() => isSceneActive(page, 'World')).toBe(true);
    await page.waitForTimeout(400);
    expect(await getShots(page)).toEqual({});
    await page.mouse.up();
    await page.mouse.up({ button: 'right' });
  });

  test('pivots in place with A/D', async ({ page }) => {
    await enterWorld(page);
    const start = await getPawn(page);
    const turned = await holdKey(page, 'd', 500);
    expect(turned.heading).toBeGreaterThan(start.heading + 0.5);
    expect(turned.x).toBeCloseTo(start.x, 0);
    expect(turned.y).toBeCloseTo(start.y, 0);
  });

  test('ramming a wall kills momentum and it reverses straight away', async ({ page }) => {
    test.setTimeout(20_000);
    const errors = collectErrors(page);
    await enterWorld(page);
    // Spawns facing north at y=408; the north wall's inner edge is y=16.
    const atWall = await holdKey(page, 'w', 7_000);
    expect(atWall.y).toBeLessThan(40);
    expect(Math.abs(atWall.speed)).toBeLessThan(2);

    const reversing = await holdKey(page, 's', 600);
    expect(reversing.speed).toBeLessThan(-10);
    expect(reversing.y).toBeGreaterThan(atWall.y);
    expect(errors).toEqual([]);
  });

  test('turret traverses toward the mouse at a limited rate', async ({ page }) => {
    await enterWorld(page);
    // The mouse aims from the first frame, so park it due north (the camera centres on the tank).
    const north = await canvasPoint(page, 0.5, 0.05);
    await page.mouse.move(north.x, north.y);
    await expect.poll(async () => (await getPawn(page)).turretAngle).toBeCloseTo(-Math.PI / 2, 1);
    const start = await getPawn(page);

    const east = await canvasPoint(page, 0.95, 0.5);
    await page.mouse.move(east.x, east.y);
    await page.waitForTimeout(100);
    const early = await getPawn(page);
    expect(early.turretAngle).toBeLessThan(-0.5); // still swinging, not snapped
    await expect.poll(async () => (await getPawn(page)).turretAngle).toBeCloseTo(0, 1);
    // The hull didn't turn with it.
    expect((await getPawn(page)).heading).toBeCloseTo(start.heading, 5);
  });

  test('right click fires the main gun at its cooldown, left click the coax MG', async ({
    page,
  }) => {
    await enterWorld(page);
    const p = await canvasPoint(page, 0.5, 0.1);
    await page.mouse.move(p.x, p.y);

    // 0.8 s cooldown: holding for 2 s gives shots at 0, 0.8 and 1.6 s.
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(2_000);
    await page.mouse.up({ button: 'right' });
    const gun = (await getShots(page)).gun_105 ?? 0;
    expect(gun).toBeGreaterThanOrEqual(2);
    expect(gun).toBeLessThanOrEqual(3);
    expect((await getShots(page)).coax_mg).toBeUndefined();

    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.mouse.up();
    const shots = await getShots(page);
    expect(shots.coax_mg).toBeGreaterThan(3);
    expect(shots.gun_105).toBe(gun);
  });
});

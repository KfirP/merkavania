import { expect, test } from '@playwright/test';
import { collectErrors, damagePlayer, enterWorld, getPawn, setGod, teleport } from './helpers';

/** M3 combat in the test world (public/maps/test). The minefield patch is cols 65–72, rows 28–31. */
const TILE = 16;
const NORTH = -Math.PI / 2;

test.describe('player damage', () => {
  test('the minefield hurts the Mk2', async ({ page }) => {
    const errors = collectErrors(page);
    await enterWorld(page);
    expect((await getPawn(page)).hp).toBe(100);
    await teleport(page, 68.5 * TILE, 29.5 * TILE, NORTH);
    await expect.poll(async () => (await getPawn(page)).hp).toBeLessThan(90);
    expect(errors).toEqual([]);
  });

  test('dying respawns the tank at the start with full HP', async ({ page }) => {
    const errors = collectErrors(page);
    await enterWorld(page);
    const start = await getPawn(page);
    await teleport(page, 40 * TILE, 8 * TILE, NORTH);
    await damagePlayer(page, 999);
    await expect.poll(async () => (await getPawn(page)).alive).toBe(false);
    await expect.poll(async () => (await getPawn(page)).alive, { timeout: 5_000 }).toBe(true);
    const p = await getPawn(page);
    expect(p.hp).toBe(p.maxHp);
    expect(Math.hypot(p.x - start.x, p.y - start.y)).toBeLessThan(1);
    expect(errors).toEqual([]);
  });

  test('god mode ignores damage', async ({ page }) => {
    await enterWorld(page);
    await setGod(page, true);
    await damagePlayer(page, 999);
    await page.waitForTimeout(200);
    const p = await getPawn(page);
    expect(p.alive).toBe(true);
    expect(p.hp).toBe(p.maxHp);
  });
});

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  aimAt,
  collectErrors,
  damagePlayer,
  enterWorld,
  getCombatLog,
  getDestructibles,
  getPawn,
  getWorld,
  setGod,
  teleport,
} from './helpers';

/**
 * M3 combat in the test world (public/maps/test). The minefield patch is cols 65–72, rows 28–31;
 * chunk x00_y01 has a destructible row at world row 18: sandbag col 2, wood 5, concrete 8,
 * armored 11.
 */
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

test.describe('destructibles', () => {
  const ROW_Y = 18.5 * TILE;
  const TANK_Y = 22 * TILE;
  const colX = (col: number) => (col + 0.5) * TILE;
  const key = (id: string) => `test_x00_y01:${id}`;
  const keys = async (page: Page) => (await getDestructibles(page)).map((d) => d.key);

  /** Parks the tank below column `col`, facing north, with the turret on the block. */
  async function faceBlock(page: Page, col: number) {
    await teleport(page, colX(col), TANK_Y, NORTH);
    await aimAt(page, colX(col), ROW_Y);
    await expect.poll(() => keys(page)).toContain(key('sandbag_1'));
  }

  test('the cannon breaks a sandbag, and it stays broken after its chunk reloads', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await enterWorld(page);
    await faceBlock(page, 2);
    await page.mouse.down({ button: 'right' });
    await expect.poll(() => keys(page)).not.toContain(key('sandbag_1'));
    await page.mouse.up({ button: 'right' });
    const log = await getCombatLog(page);
    expect(log.some((h) => h.target === key('sandbag_1') && h.killed)).toBe(true);

    // x03 is 3 chunks away, so x00_y01 streams out; then come back.
    await teleport(page, 104 * TILE, 14 * TILE, NORTH);
    await expect.poll(async () => (await getWorld(page)).loaded).not.toContain('test_x00_y01');
    await teleport(page, colX(5), TANK_Y, NORTH);
    await expect.poll(() => keys(page)).toContain(key('wood_1'));
    expect(await keys(page)).not.toContain(key('sandbag_1'));
    expect(errors).toEqual([]);
  });

  test('the coax MG chews through wood', async ({ page }) => {
    await enterWorld(page);
    await faceBlock(page, 5);
    await page.mouse.down();
    await expect.poll(() => keys(page)).not.toContain(key('wood_1'));
    await page.mouse.up();
  });

  test('standard shells bounce off concrete', async ({ page }) => {
    await enterWorld(page);
    await faceBlock(page, 8);
    await page.mouse.down({ button: 'right' });
    await expect
      .poll(async () => (await getCombatLog(page)).filter((h) => h.target === key('concrete_1')))
      .not.toEqual([]);
    await page.mouse.up({ button: 'right' });
    const hits = (await getCombatLog(page)).filter((h) => h.target === key('concrete_1'));
    expect(hits.every((h) => h.ricochet && h.damage === 0)).toBe(true);
    const concrete = (await getDestructibles(page)).find((d) => d.key === key('concrete_1'));
    expect(concrete?.hp).toBe(80);
  });
});

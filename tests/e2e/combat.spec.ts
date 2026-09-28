import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  aimAt,
  collectErrors,
  damagePlayer,
  enterWorld,
  getCombatLog,
  getDestructibles,
  getEnemies,
  getPawn,
  getWorld,
  setGod,
  spawnEnemy,
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

/**
 * Enemies spawned through the debug hook in chunk x00_y00's open ground, away from the map's own
 * enemies (x03_y01). The tank parks at (20.5, 12) tiles facing north; the enemy sits 7 tiles up.
 */
test.describe('enemies', () => {
  const TANK = { x: 20.5 * TILE, y: 12 * TILE };
  const FOE = { x: 20.5 * TILE, y: 5 * TILE };
  const SOUTH = Math.PI / 2;
  const hitsOn = async (page: Page, type: string) => {
    const ids = new Set((await getEnemies(page)).filter((e) => e.type === type).map((e) => e.id));
    return (await getCombatLog(page)).filter((h) => ids.has(h.target) || h.target.includes(type));
  };

  async function faceOff(page: Page, type: string, god = true) {
    await enterWorld(page);
    await setGod(page, god);
    await teleport(page, TANK.x, TANK.y, NORTH);
    await spawnEnemy(page, type, FOE.x, FOE.y, SOUTH);
    await expect.poll(async () => (await getEnemies(page)).length).toBeGreaterThan(0);
  }

  test('the cannon kills a rifle-squad soldier', async ({ page }) => {
    const errors = collectErrors(page);
    await faceOff(page, 'rifle_squad');
    expect((await getEnemies(page)).filter((e) => e.type === 'rifle_squad')).toHaveLength(3);
    await aimAt(page, FOE.x, FOE.y);
    await page.mouse.down({ button: 'right' });
    await expect
      .poll(async () => (await getEnemies(page)).filter((e) => e.type === 'rifle_squad').length)
      .toBeLessThan(3);
    await page.mouse.up({ button: 'right' });
    const kills = (await getCombatLog(page)).filter((h) => h.killed && h.weapon === 'gun_105');
    expect(kills.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('the coax MG ricochets off a bunker', async ({ page }) => {
    await faceOff(page, 'bunker_mg');
    await aimAt(page, FOE.x, FOE.y);
    await page.mouse.down();
    await expect.poll(async () => (await hitsOn(page, 'bunker_mg')).length).toBeGreaterThan(3);
    await page.mouse.up();
    const hits = await hitsOn(page, 'bunker_mg');
    expect(hits.every((h) => h.weapon === 'coax_mg' && h.ricochet && h.damage < 0.5)).toBe(true);
  });

  test('a technical shoots back', async ({ page }) => {
    await faceOff(page, 'technical', false);
    await expect.poll(async () => (await getPawn(page)).hp, { timeout: 8_000 }).toBeLessThan(100);
    const log = await getCombatLog(page);
    expect(log.some((h) => h.target === 'player' && h.weapon === 'mg_technical')).toBe(true);
  });

  test('the ATGM team telegraphs, then its missile finds the tank', async ({ page }) => {
    await faceOff(page, 'atgm_team');
    await expect
      .poll(
        async () =>
          (await getCombatLog(page)).some((h) => h.target === 'player' && h.weapon === 'atgm'),
        { timeout: 12_000 },
      )
      .toBe(true);
  });

  test('a shell fired on level 0 cannot hit an enemy on the plateau', async ({ page }) => {
    await enterWorld(page);
    await setGod(page, true);
    // The level-1 plateau spans rows 2–10 above x=70..109; its south face is row 11.
    await teleport(page, 78.5 * TILE, 14 * TILE, NORTH);
    await spawnEnemy(page, 'bunker_mg', 78.5 * TILE, 6 * TILE, SOUTH);
    // x03_y01's own enemies stream in here too, so look at the debug spawn only.
    const bunker = async () => (await getEnemies(page)).find((e) => e.id.startsWith('debug'));
    await expect.poll(bunker).toBeDefined();
    expect((await bunker())!.level).toBe(1);
    await aimAt(page, 78.5 * TILE, 6 * TILE);
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(2_000);
    await page.mouse.up({ button: 'right' });
    const b = (await bunker())!;
    expect((await getCombatLog(page)).filter((h) => h.target === b.id)).toEqual([]);
    expect(b.hp).toBe(b.maxHp);
  });

  test('the tank crushes infantry it drives over', async ({ page }) => {
    await enterWorld(page);
    await setGod(page, true);
    await teleport(page, TANK.x, TANK.y, NORTH);
    await spawnEnemy(page, 'rifle_squad', TANK.x, TANK.y - 40, SOUTH);
    await expect.poll(async () => (await getEnemies(page)).length).toBe(3);
    await page.keyboard.down('w');
    await expect.poll(async () => (await getEnemies(page)).length).toBeLessThan(3);
    await page.keyboard.up('w');
  });

  test('respawning clears the fight', async ({ page }) => {
    await faceOff(page, 'technical', false);
    await damagePlayer(page, 999);
    await expect.poll(async () => (await getPawn(page)).alive, { timeout: 5_000 }).toBe(true);
    expect((await getEnemies(page)).filter((e) => e.id.startsWith('debug'))).toEqual([]);
  });
});

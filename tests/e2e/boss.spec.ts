import { expect, test, type Page } from '@playwright/test';
import {
  collectErrors,
  getCombatLog,
  getEnemies,
  getPawn,
  getState,
  grantAbility,
  holdKey,
  isSceneActive,
  pointMouseAt,
  setGod,
  teleport,
} from './helpers';

/**
 * boss_desert (M7) in its arena, desert_x04_y03: the command bunker at (2184, 888) with its rail
 * gun on y 952. The arena is tiles 121–147 × 53–65; the steep yard terrace (level 1) is around
 * (2200, 344), and the final radios sit on the plateau at tiles 36–43 × 5–11.
 */
const TILE = 16;
const NORTH = -Math.PI / 2;
const BUNKER = { x: 2184, y: 888 };
const IN_ARENA = { x: 126 * TILE + 8, y: 62 * TILE + 8 };
const BOSS_KEY = 'desert_x04_y03:bunker';

function getBoss(page: Page) {
  return page.evaluate(() => window.__merkavania?.getBoss() ?? null);
}

function damageBoss(page: Page, amount: number) {
  return page.evaluate((n) => window.__merkavania?.damageBoss(n), amount);
}

/** Radio message keys on screen or waiting, in order. */
function radioKeys(page: Page) {
  return page.evaluate(() => {
    const radio = window.__merkavania?.getHud()?.radio;
    return radio ? [radio.messageKey, ...radio.queued] : [];
  });
}

async function enterDesert(page: Page, query = '') {
  await page.goto(`/?debug=1${query}`);
  await expect.poll(() => isSceneActive(page, 'Title')).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => isSceneActive(page, 'Hud')).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__merkavania?.getPawn() != null)).toBe(true);
  await setGod(page, true);
}

async function click(page: Page, button: 'left' | 'right') {
  await page.mouse.down({ button });
  await page.waitForTimeout(80);
  await page.mouse.up({ button });
}

test.describe('boss_desert', () => {
  test('wakes in its arena, telegraphs before it shoots, and its roof hates mortars', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await enterDesert(page);
    await teleport(page, IN_ARENA.x - 160, IN_ARENA.y, NORTH); // the approach, outside
    await page.waitForTimeout(300);
    expect((await getBoss(page))?.boss?.mode).toBe('dormant');

    await teleport(page, IN_ARENA.x, IN_ARENA.y, NORTH);
    await expect.poll(async () => (await getBoss(page))?.boss?.mode).toBe('intro');
    await expect.poll(() => radioKeys(page)).toContain('radio.desert.boss_intro');
    await expect
      .poll(() => page.evaluate(() => window.__merkavania?.getHud()?.boss?.name ?? null))
      .toBe('COMMAND BUNKER');
    // The laser comes up before the first shot.
    await expect
      .poll(async () => (await getBoss(page))?.boss?.telegraphing, { timeout: 10_000 })
      .toBe(true);
    expect((await getBoss(page))!.boss!.shots).toBe(0);
    await expect.poll(async () => (await getBoss(page))?.boss?.shots ?? 0).toBeGreaterThan(0);

    // A 105mm shell, then a mortar round on the roof: double damage for the mortar.
    await pointMouseAt(page, BUNKER.x, BUNKER.y);
    await click(page, 'right');
    const hits = (weapon: string) => async () =>
      (await getCombatLog(page)).filter((h) => h.target === BOSS_KEY && h.weapon === weapon);
    await expect.poll(async () => (await hits('gun_105')()).length).toBeGreaterThan(0);
    const cannon = (await hits('gun_105')())[0]!.damage;

    await grantAbility(page, 'mortar');
    await holdKey(page, 'e', 100);
    await expect.poll(async () => (await getState(page)).selectedSecondary).toBe('mortar');
    await pointMouseAt(page, BUNKER.x, BUNKER.y);
    await click(page, 'left');
    await expect.poll(async () => (await hits('mortar_60')()).length).toBeGreaterThan(0);
    const mortar = (await hits('mortar_60')())[0]!.damage;
    // 35 × 0.8 × 2 against 40 × 0.8: the mortar does 1.75× the 105's damage.
    expect(mortar / cannon).toBeCloseTo(1.75, 1);
    expect(errors).toEqual([]);
  });

  test('below half health it calls in reinforcements', async ({ page }) => {
    await enterDesert(page);
    await teleport(page, IN_ARENA.x, IN_ARENA.y, NORTH);
    await expect.poll(async () => (await getBoss(page))?.boss?.mode).toBe('fight');
    const before = (await getEnemies(page)).length;
    await damageBoss(page, 320);
    await expect.poll(async () => (await getBoss(page))?.boss?.phase).toBe(2);
    await expect
      .poll(async () => (await getBoss(page))?.boss?.helpers ?? 0, { timeout: 20_000 })
      .toBeGreaterThan(0);
    expect((await getEnemies(page)).length).toBeGreaterThan(before);
  });

  test('beaten, it leaves the Mk3 upgrade; the Mk3 takes the steep ramp to the final radio, and it all sticks', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await enterDesert(page);
    await teleport(page, IN_ARENA.x, IN_ARENA.y, NORTH);
    await expect.poll(async () => (await getBoss(page))?.boss?.mode).toBe('fight');
    await damageBoss(page, 9999);
    await expect.poll(async () => (await getBoss(page))?.boss ?? 'gone').toBe('gone');
    const upgrade = (await getBoss(page))!.upgrade!;
    expect(upgrade.tier).toBe('mk3');
    await expect.poll(() => radioKeys(page)).toContain('radio.desert.boss_down');
    await expect.poll(async () => (await getState(page)).flags[BOSS_KEY] ?? false).toBe(true);

    // Drive onto the crate.
    await teleport(page, upgrade.x, upgrade.y + 24, NORTH);
    await holdKey(page, 'w', 600);
    await expect.poll(async () => (await getState(page)).mk).toBe('mk3');
    expect((await getState(page)).abilities).toContain('suspension');
    expect((await getPawn(page)).maxHp).toBe(160);
    await expect.poll(async () => (await getBoss(page))?.upgrade ?? null).toBeNull();

    // Up the steep ramp from the yard terrace to the plateau.
    const start = await teleport(page, 137 * TILE + 8, 21 * TILE + 8, NORTH);
    expect(start.level).toBe(1);
    const top = await holdKey(page, 'w', 2_500);
    expect(top.level).toBe(2);

    // The final radios on the plateau's west end.
    await teleport(page, 39 * TILE, 8 * TILE, NORTH);
    await expect.poll(() => radioKeys(page)).toContain('radio.desert.final_01');

    // Continue: the bunker stays beaten and the tank stays an Mk3, with no crate to take again.
    await enterDesert(page, '&slot=1');
    expect((await getState(page)).mk).toBe('mk3');
    await teleport(page, IN_ARENA.x, IN_ARENA.y, NORTH);
    await page.waitForTimeout(500);
    expect(await getBoss(page)).toBeNull();
  });
});

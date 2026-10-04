import { expect, test, type Page } from '@playwright/test';
import {
  collectErrors,
  damagePlayer,
  getPawn,
  getState,
  holdKey,
  isSceneActive,
  teleport,
} from './helpers';

const EAST = 0;
/** The test world's progression gallery depot pad (see progression.spec.ts). */
const DEPOT = { x: 160, y: 608 };

/** A version-1 save (before repair charges existed) with two repair kits. */
const V1_SAVE = {
  version: 1,
  updatedAt: 1,
  playtimeMs: 0,
  mk: 'mk2',
  abilities: [],
  minor: { armor_plate: 0, ammo_rack: 0, repair_kit: 2 },
  selectedSecondary: 'coax_mg',
  secondaryAmmo: {},
  depotId: null,
  flags: {},
  visitedChunks: {},
};

async function enterWithKits(page: Page) {
  await page.goto('/?debug=1&world=test');
  await page.evaluate((s) => localStorage.setItem('merkavania.save.1', JSON.stringify(s)), V1_SAVE);
  await page.reload();
  await expect.poll(() => isSceneActive(page, 'Title')).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__merkavania?.getPawn() != null)).toBe(true);
}

test.describe('repair kit', () => {
  test('R spends a charge to heal; nothing happens at full HP; the depot refills it', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await enterWithKits(page);
    // The v1 save migrated: both kits charged.
    expect((await getState(page)).repairCharges).toBe(2);

    await holdKey(page, 'r', 100);
    await page.waitForTimeout(100);
    expect((await getState(page)).repairCharges).toBe(2);

    const full = (await getPawn(page)).hp;
    await damagePlayer(page, 60);
    await expect.poll(async () => (await getPawn(page)).hp).toBe(full - 60);
    await holdKey(page, 'r', 100);
    await expect.poll(async () => (await getPawn(page)).hp).toBe(full - 60 + full / 2);
    expect((await getState(page)).repairCharges).toBe(1);

    await teleport(page, DEPOT.x - 40, DEPOT.y, EAST);
    await teleport(page, DEPOT.x, DEPOT.y, EAST);
    await expect.poll(async () => (await getState(page)).repairCharges).toBe(2);
    expect(errors).toEqual([]);
  });

  test('the scout cannot use it', async ({ page }) => {
    await enterWithKits(page);
    await page.evaluate(() => window.__merkavania?.grantAbility('hatch_scout'));
    await damagePlayer(page, 60);
    await page.evaluate(() => window.__merkavania?.pressHatch());
    await expect.poll(async () => (await getPawn(page)).kind).toBe('scout');
    await holdKey(page, 'r', 100);
    await page.waitForTimeout(100);
    expect((await getState(page)).repairCharges).toBe(2);
  });
});

import { expect, test, type Page } from '@playwright/test';
import {
  canvasPoint,
  collectErrors,
  enterWorld,
  getPawn,
  getShots,
  getState,
  holdKey,
  isSceneActive,
  teleport,
} from './helpers';

/**
 * The Mk3 upgrade (M7): the tank swaps sprites, gun and HP in place, takes the steep ramp to the
 * test world's level-2 shelf (cols 92–95, rows 3–6, see world.spec.ts), and the tier is saved.
 */
const TILE = 16;
const EAST = 0;

function setMk(page: Page, mk: string) {
  return page.evaluate((m) => window.__merkavania?.setMk(m as never), mk);
}

function getHud(page: Page) {
  return page.evaluate(() => window.__merkavania?.getHud() ?? null);
}

test.describe('Mk3 upgrade', () => {
  test('swaps in the Mk3: HUD tier, full 160 HP, 5 quick rounds and the 120mm', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await enterWorld(page);
    await setMk(page, 'mk3');
    await expect.poll(async () => (await getState(page)).mk).toBe('mk3');
    expect((await getState(page)).abilities).toContain('suspension');
    await expect.poll(async () => (await getPawn(page)).maxHp).toBe(160);
    expect((await getPawn(page)).hp).toBe(160);
    await expect.poll(async () => (await getHud(page))?.tier).toContain('3');
    expect((await getHud(page))?.gunMax).toBe(5);

    const p = await canvasPoint(page, 0.5, 0.1);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(300);
    await page.mouse.up({ button: 'right' });
    await expect.poll(async () => (await getShots(page)).gun_120 ?? 0).toBeGreaterThanOrEqual(1);
    expect((await getShots(page)).gun_105).toBeUndefined();
    expect(errors).toEqual([]);
  });

  test('climbs the steep ramp the Mk2 cannot', async ({ page }) => {
    await enterWorld(page);
    await setMk(page, 'mk3');
    await expect.poll(async () => (await getState(page)).mk).toBe('mk3');
    const start = await teleport(page, 86 * TILE, 5 * TILE, EAST);
    expect(start.level).toBe(1);
    const p = await holdKey(page, 'w', 3_000);
    expect(p.level).toBe(2);
    expect(p.x).toBeGreaterThan(96 * TILE);
  });

  test('is saved at once and kept after a reload', async ({ page }) => {
    await enterWorld(page);
    await setMk(page, 'mk3');
    await expect
      .poll(() =>
        page.evaluate(
          () => (window.__merkavania?.getSave(1) as { mk?: string } | null)?.mk ?? null,
        ),
      )
      .toBe('mk3');

    await page.goto('/?debug=1&world=test&slot=1');
    await expect.poll(() => isSceneActive(page, 'Title')).toBe(true);
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.__merkavania?.getPawn() != null)).toBe(true);
    expect((await getState(page)).mk).toBe('mk3');
    expect((await getPawn(page)).maxHp).toBe(160);
  });
});

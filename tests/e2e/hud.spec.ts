import { expect, test, type Page } from '@playwright/test';
import {
  collectErrors,
  damagePlayer,
  enterWorld,
  getPawn,
  grantAbility,
  holdKey,
  isSceneActive,
  pressKey,
  teleport,
} from './helpers';

const EAST = 0;
const START = { x: 300, y: 680 };

function getHud(page: Page) {
  return page.evaluate(() => window.__merkavania?.getHud() ?? null);
}

async function hud(page: Page) {
  const h = await getHud(page);
  if (!h) throw new Error('No HUD');
  return h;
}

test.describe('HUD', () => {
  test('shows HP, the Mk tier, gun rounds and the selected secondary', async ({ page }) => {
    const errors = collectErrors(page);
    await enterWorld(page);
    const h = await hud(page);
    expect(h.tier).toBe('MK2');
    expect(h.hpText).toBe('100');
    expect(h.secondary).toBe('COAX MG');
    expect(h.repair).toBeNull();
    expect(h.gunRounds).toBe(h.gunMax);
    expect(h.gunMax).toBeGreaterThan(0);

    await damagePlayer(page, 30);
    await expect.poll(async () => (await hud(page)).hpText).toBe('70');

    await teleport(page, START.x, START.y, EAST);
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(100);
    await page.mouse.up({ button: 'right' });
    await expect.poll(async () => (await hud(page)).gunRounds).toBe(h.gunMax - 1);

    await grantAbility(page, 'mortar');
    await holdKey(page, 'e', 100);
    await expect.poll(async () => (await hud(page)).secondary).toMatch(/^MORTAR \d+\/\d+$/);
    expect(errors).toEqual([]);
  });

  test('the minimap marks the current chunk and the ones visited', async ({ page }) => {
    await enterWorld(page);
    await teleport(page, START.x, START.y, EAST);
    const first = await getPawn(page);
    let m = (await hud(page)).minimap;
    expect(m[1]![1]).toBe('current');
    // One chunk east, then look back west.
    await teleport(page, START.x + 480, START.y, EAST);
    await expect.poll(async () => (await getPawn(page)).chunk).not.toBe(first.chunk);
    await expect.poll(async () => (await hud(page)).minimap[1]![0]).toBe('visited');
    m = (await hud(page)).minimap;
    expect(m[1]![1]).toBe('current');
  });

  test('mirrors in Hebrew', async ({ page }) => {
    await page.goto('/?debug=1');
    await page.evaluate(() =>
      localStorage.setItem('merkavania.settings', JSON.stringify({ language: 'he' })),
    );
    await page.reload();
    await expect.poll(() => isSceneActive(page, 'Title')).toBe(true);
    await page.keyboard.press('Enter');
    await expect.poll(() => isSceneActive(page, 'Hud')).toBe(true);
    await expect.poll(async () => (await getHud(page))?.rtl ?? null).toBe(true);
    const h = await hud(page);
    expect(h.hpBarX).toBeGreaterThan(240);
    expect(h.secondary).toBe('מקלע מקביל');
  });

  test('switching language mid-game rebuilds the HUD with what it showed', async ({ page }) => {
    const errors = collectErrors(page);
    await enterWorld(page);
    await damagePlayer(page, 30);
    await expect.poll(async () => (await hud(page)).hpText).toBe('70');
    // An enemy's HP event must not take the player's place after the rebuild.
    await page.evaluate(() => window.__merkavania?.spawnEnemy('technical', 900, 100));
    await page.keyboard.down('Escape');
    await page.waitForTimeout(100);
    await page.keyboard.up('Escape');
    await expect.poll(() => isSceneActive(page, 'Pause')).toBe(true);
    await pressKey(page, 'ArrowDown');
    await pressKey(page, 'Enter');
    await expect.poll(() => isSceneActive(page, 'Settings')).toBe(true);
    await pressKey(page, 'ArrowRight');
    await expect.poll(async () => (await hud(page)).rtl).toBe(true);
    const h = await hud(page);
    expect(h.hpText).toBe('70');
    expect(h.tier).toBe('MK2');
    expect(h.secondary).toBe('מקלע מקביל');
    expect(h.hpBarX).toBeGreaterThan(240);
    expect(h.minimap[1]![1]).toBe('current');
    expect(errors).toEqual([]);
  });
});

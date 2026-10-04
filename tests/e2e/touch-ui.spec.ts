import { expect, test, type Page } from '@playwright/test';
import {
  collectErrors,
  damagePlayer,
  fingers,
  getPawn,
  getState,
  grantAbility,
  isSceneActive,
} from './helpers';

/** The canvas is 2× here: page px = 2 × game px (see logic/input/touchButtons.ts). */
const PAUSE_BUTTON = { x: 2 * 258, y: 2 * 14 };
const MAP_BUTTON = { x: 2 * 222, y: 2 * 14 };
const SWAP_BUTTON = { x: 2 * 410, y: 2 * 120 };
const REPAIR_BUTTON = { x: 2 * 30, y: 2 * 150 };

function isPaused(page: Page, key: string) {
  return page.evaluate((k) => window.__merkavania?.game.scene.isPaused(k) ?? false, key);
}

function buttonVisible(page: Page, id: string) {
  return page.evaluate(
    (id) => window.__merkavania?.getTouchButtons()?.includes(id as never) ?? false,
    id,
  );
}

async function enter(page: Page, settings?: object) {
  await page.goto('/?debug=1&world=test');
  if (settings) {
    await page.evaluate(
      (s) => localStorage.setItem('merkavania.settings', JSON.stringify(s)),
      settings,
    );
    await page.reload();
  }
  await expect.poll(() => isSceneActive(page, 'Title')).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__merkavania?.getPawn() != null)).toBe(true);
}

test.describe('touch buttons', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 960, height: 540 } });

  test('pause and map buttons open their overlays', async ({ page, context }) => {
    const errors = collectErrors(page);
    await enter(page);
    const f = await fingers(page, context);
    await f.tap(1, PAUSE_BUTTON.x, PAUSE_BUTTON.y);
    await expect.poll(() => isSceneActive(page, 'Pause')).toBe(true);
    expect(await isPaused(page, 'World')).toBe(true);
    // Tap Resume (the first row).
    const resume = await page.evaluate(() => window.__merkavania?.getMenu('Pause')?.rects[0]);
    await f.tap(2, (resume!.x + resume!.width / 2) * 960, (resume!.y + resume!.height / 2) * 540);
    await expect.poll(() => isPaused(page, 'World')).toBe(false);

    await f.tap(3, MAP_BUTTON.x, MAP_BUTTON.y);
    await expect.poll(() => isSceneActive(page, 'Map')).toBe(true);
    await f.tap(4, 480, 270);
    await expect.poll(() => isSceneActive(page, 'Map')).toBe(false);
    await expect.poll(() => isPaused(page, 'World')).toBe(false);
    expect(errors).toEqual([]);
  });

  test('swap cycles the secondary once there is a choice', async ({ page, context }) => {
    await enter(page);
    expect(await buttonVisible(page, 'swap')).toBe(false);
    await grantAbility(page, 'mortar');
    await expect.poll(() => buttonVisible(page, 'swap')).toBe(true);
    const f = await fingers(page, context);
    await f.tap(1, SWAP_BUTTON.x, SWAP_BUTTON.y);
    await expect.poll(async () => (await getState(page)).selectedSecondary).toBe('mortar');
  });

  test('the repair button shows with a charge and a tap heals', async ({ page, context }) => {
    await enter(page);
    expect(await buttonVisible(page, 'repair')).toBe(false);
    // Reload with a repair kit in slot 1.
    await page.evaluate(() =>
      localStorage.setItem(
        'merkavania.save.1',
        JSON.stringify({
          version: 1,
          updatedAt: 1,
          playtimeMs: 0,
          mk: 'mk2',
          abilities: [],
          minor: { armor_plate: 0, ammo_rack: 0, repair_kit: 1 },
          selectedSecondary: 'coax_mg',
          secondaryAmmo: {},
          depotId: null,
          flags: {},
          visitedChunks: {},
        }),
      ),
    );
    await enter(page);
    await expect.poll(() => buttonVisible(page, 'repair')).toBe(true);
    await damagePlayer(page, 60);
    await expect.poll(async () => (await getPawn(page)).hp).toBe(40);
    const f = await fingers(page, context);
    await f.tap(1, REPAIR_BUTTON.x, REPAIR_BUTTON.y);
    await expect.poll(async () => (await getPawn(page)).hp).toBe(90);
    await expect.poll(() => buttonVisible(page, 'repair')).toBe(false);
  });

  test('touch controls off: never shown', async ({ page }) => {
    await enter(page, { touchControls: 'off' });
    await page.waitForTimeout(300);
    expect(await isSceneActive(page, 'TouchControls')).toBe(false);
  });
});

test.describe('touch controls forced on', () => {
  test('a desktop shows them straight away', async ({ page }) => {
    await enter(page, { touchControls: 'on' });
    await expect.poll(() => isSceneActive(page, 'TouchControls')).toBe(true);
    await expect
      .poll(() =>
        page.evaluate(
          () => window.__merkavania!.game.scene.getScene('TouchControls').cameras.main.visible,
        ),
      )
      .toBe(true);
  });
});

test.describe('rotate prompt', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test('portrait shows it and pauses the game; landscape hides it', async ({ page }) => {
    await enter(page);
    const prompt = page.locator('#rotate');
    await expect(prompt).toBeVisible();
    await expect(prompt).toContainText('Rotate');
    await expect.poll(() => isSceneActive(page, 'Pause')).toBe(true);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(prompt).toBeHidden();
  });
});

import { expect, test, type Page } from '@playwright/test';
import { collectErrors, enterWorld, getPawn, isSceneActive, pressKey, teleport } from './helpers';

const EAST = 0;
/** The progression gallery depot pad, in chunk test_x00_y02. */
const DEPOT = { x: 160, y: 608, key: 'test_x00_y02:depot_gallery' };

function getMapView(page: Page) {
  return page.evaluate(() => window.__merkavania?.getMapView() ?? null);
}

function isPaused(page: Page, key: string) {
  return page.evaluate((k) => window.__merkavania?.game.scene.isPaused(k) ?? false, key);
}

/** Gameplay polls keys once per frame: hold the map key for a few. */
async function openMap(page: Page, key = 'm') {
  await page.keyboard.down(key);
  await page.waitForTimeout(100);
  await page.keyboard.up(key);
  await expect.poll(() => isSceneActive(page, 'Map')).toBe(true);
  await expect.poll(() => isPaused(page, 'World')).toBe(true);
}

test.describe('map screen', () => {
  test('M opens the map over the paused world and M closes it', async ({ page }) => {
    const errors = collectErrors(page);
    await enterWorld(page);
    const pawn = await getPawn(page);
    await openMap(page);
    const view = (await getMapView(page))!;
    const current = view.cells.filter((c) => c.current);
    expect(current.map((c) => c.id)).toEqual([pawn.chunk]);
    // The pawn dot sits inside its chunk's cell.
    const cell = current[0]!;
    expect(view.pawn.x).toBeGreaterThanOrEqual(cell.x);
    expect(view.pawn.x).toBeLessThanOrEqual(cell.x + cell.w);

    await pressKey(page, 'KeyM');
    await expect.poll(() => isSceneActive(page, 'Map')).toBe(false);
    await page.waitForTimeout(300);
    expect(await isPaused(page, 'World')).toBe(false);
    expect(errors).toEqual([]);
  });

  test('shows a depot in a visited chunk; Tab opens and Esc closes', async ({ page }) => {
    await enterWorld(page);
    await teleport(page, DEPOT.x, DEPOT.y, EAST);
    await openMap(page, 'Tab');
    const view = (await getMapView(page))!;
    expect(view.cells.map((c) => c.id)).toContain('test_x00_y02');
    expect(view.markers.filter((m) => m.kind === 'depot').map((m) => m.key)).toContain(DEPOT.key);
    await pressKey(page, 'Escape');
    await expect.poll(() => isSceneActive(page, 'Map')).toBe(false);
  });

  test('a tap closes it', async ({ page }) => {
    await enterWorld(page);
    await openMap(page);
    const canvas = (await page.locator('canvas').boundingBox())!;
    await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await expect.poll(() => isSceneActive(page, 'Map')).toBe(false);
  });
});

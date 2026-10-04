import { expect, test } from '@playwright/test';
import { collectErrors, getPawn, getWorld, isSceneActive, teleport } from './helpers';

/**
 * The desert (M7), the world a new game plays: it boots at the start outpost (x00_y02) and streams
 * its chunks. Layouts live in maps-src/desert; see scripts/desert-world.test.ts for the content.
 */
const TILE = 16;
const NORTH = -Math.PI / 2;

test.describe('desert', () => {
  test('a new game starts in the desert outpost without errors', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/?debug=1');
    await expect.poll(() => isSceneActive(page, 'Title')).toBe(true);
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.__merkavania?.getPawn() != null)).toBe(true);
    const pawn = await getPawn(page);
    expect(pawn.chunk).toBe('desert_x00_y02');
    expect(pawn.level).toBe(0);
    expect((await getWorld(page)).loaded).toContain('desert_x01_y02');

    // Out to the far corner: the boss arena chunk streams in.
    const far = await teleport(page, 130 * TILE, 62 * TILE, NORTH);
    expect(far.chunk).toBe('desert_x04_y03');
    await expect.poll(async () => (await getWorld(page)).chunk).toBe('desert_x04_y03');
    expect(errors).toEqual([]);
  });
});

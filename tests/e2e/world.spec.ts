import { expect, test } from '@playwright/test';
import { collectErrors, enterWorld, getWorld, holdKey, teleport } from './helpers';

/**
 * The M2 test world (public/maps/test): the M1 room is chunks x00–x01, and x02–x03 hold a level-1
 * plateau (rows 2–10, cols 70–109) with a ramp north (cols 86–90, rows 11–12), a level-2 shelf
 * behind a steep ramp east (cols 92–95, rows 3–6), the road east (rows 16–17) and terrain patches.
 * Row y02 is the M4 progression gallery (progression.spec.ts).
 */
const TILE = 16;
const NORTH = -Math.PI / 2;
const EAST = 0;

const chunks = (xs: string[], ys: string[]) =>
  xs.flatMap((x) => ys.map((y) => `test_x${x}_y${y}`)).sort();

test.describe('world streaming', () => {
  test('loads the 3×3 around the start and swaps chunks as the pawn moves', async ({ page }) => {
    const errors = collectErrors(page);
    await enterWorld(page);
    let world = await getWorld(page);
    expect(world.chunk).toBe('test_x01_y01');
    expect([...world.loaded].sort()).toEqual(chunks(['00', '01', '02'], ['00', '01', '02']));

    const pawn = await teleport(page, 104 * TILE, 14 * TILE, NORTH);
    expect(pawn.chunk).toBe('test_x03_y00');
    await expect.poll(async () => (await getWorld(page)).chunk).toBe('test_x03_y00');
    world = await getWorld(page);
    // x00 is 3 chunks away, outside the 5×5 window; x01 and x02 keep their y02 chunks
    // (hysteresis), while x03_y02 was never in a 3×3.
    expect([...world.loaded].sort()).toEqual(
      [...chunks(['01', '02'], ['00', '01', '02']), ...chunks(['03'], ['00', '01'])].sort(),
    );
    expect(errors).toEqual([]);
  });
});

test.describe('elevation and terrain', () => {
  test('a cliff stops the tank without changing its level', async ({ page }) => {
    await enterWorld(page);
    await teleport(page, 75 * TILE + 8, 14 * TILE + 8, NORTH);
    const p = await holdKey(page, 'w', 2_000);
    expect(p.level).toBe(0);
    // Plateau's south face is y=176; the 13px body stops against it.
    expect(p.y).toBeGreaterThan(176 + 12);
    expect(p.y).toBeLessThan(176 + 16);
  });

  test('the ramp climbs to level 1', async ({ page }) => {
    await enterWorld(page);
    await teleport(page, 88.5 * TILE, 14 * TILE + 8, NORTH);
    const p = await holdKey(page, 'w', 2_500);
    expect(p.y).toBeLessThan(10 * TILE);
    expect(p.level).toBe(1);
  });

  test('the Mk2 cannot take the steep ramp to the shelf', async ({ page }) => {
    await enterWorld(page);
    const start = await teleport(page, 86 * TILE, 5 * TILE, EAST);
    expect(start.level).toBe(1);
    const p = await holdKey(page, 'w', 3_000);
    expect(p.level).toBe(1);
    expect(p.x).toBeLessThan(96 * TILE - 12);
    expect(p.x).toBeGreaterThan(94 * TILE);
  });

  test('mud blocks the tank without wide tracks', async ({ page }) => {
    await enterWorld(page);
    await teleport(page, 62 * TILE, 23 * TILE, EAST);
    const p = await holdKey(page, 'w', 2_000);
    expect(p.x).toBeLessThan(65 * TILE - 12);
  });

  test('road is faster than sand', async ({ page }) => {
    await enterWorld(page);
    await teleport(page, 40, 8 * TILE, EAST);
    const sand = await holdKey(page, 'w', 2_500);
    await teleport(page, 62 * TILE, 17 * TILE, EAST);
    const road = await holdKey(page, 'w', 2_500);
    expect(road.speed).toBeGreaterThan(sand.speed * 1.15);
  });
});

import { expect, test, type Page } from '@playwright/test';
import {
  collectErrors,
  damagePlayer,
  enterWorld,
  getMortarLandings,
  getObjects,
  getPawn,
  getSave,
  getShots,
  getState,
  grantAbility,
  holdKey,
  isSceneActive,
  pointMouseAt,
  teleport,
} from './helpers';

/**
 * The M4 gallery, row y02 of the test world (y 544..816). x00_y02: depot pad at (160, 608),
 * pickups at y 616 (mortar 232, armor plate 296, ammo rack 360), the dozer blade at (232, 744)
 * with a boulder at (136, 744), and rubble at x 416..448 across the corridor (y 640..720) east.
 * x01_y02: a mortar switch on a level-1 shelf at (696, 584), its door at x 800..816.
 * x02_y02: a cannon switch at (1096, 584), its door at x 1200..1216.
 */
const EAST = 0;
const NORTH = -Math.PI / 2;
const CORRIDOR_Y = 680;
const MAX_HP = 100;

/**
 * Clicks with a mouse button held for a few frames: input is polled once per frame, so a press
 * whose down and up land in the same frame is never seen.
 */
async function click(page: Page, button: 'left' | 'right') {
  await page.mouse.down({ button });
  await page.waitForTimeout(100);
  await page.mouse.up({ button });
}

/** Boots straight into the world on save slot `slot`. */
async function enterSlot(page: Page, slot: number) {
  await page.goto(`/?debug=1&slot=${slot}`);
  await expect.poll(() => isSceneActive(page, 'Title')).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__merkavania?.getPawn() != null)).toBe(true);
}

test.describe('pickups and gates', () => {
  test('driving over a pickup takes it and saves straight away', async ({ page }) => {
    const errors = collectErrors(page);
    await enterWorld(page);
    await teleport(page, 200, 616, EAST);
    await holdKey(page, 'w', 900);
    await expect.poll(async () => (await getState(page)).abilities).toEqual(['mortar']);
    expect((await getObjects(page)).pickups.map((p) => p.key)).not.toContain(
      'test_x00_y02:mortar_1',
    );
    const save = (await getSave(page)) as { abilities: string[]; flags: Record<string, boolean> };
    expect(save.abilities).toEqual(['mortar']);
    expect(save.flags['test_x00_y02:mortar_1']).toBe(true);
    expect(errors).toEqual([]);
  });

  test('an armor plate raises max HP', async ({ page }) => {
    await enterWorld(page);
    await teleport(page, 264, 616, EAST);
    await holdKey(page, 'w', 900);
    await expect.poll(async () => (await getPawn(page)).maxHp).toBe(MAX_HP + 20);
    expect((await getPawn(page)).hp).toBe(MAX_HP + 20);
  });

  test('rubble blocks the tank until it has the dozer blade', async ({ page }) => {
    await enterWorld(page);
    await teleport(page, 380, CORRIDOR_Y, EAST);
    let p = await holdKey(page, 'w', 2_000);
    expect(p.x).toBeLessThan(416 - 12);

    await teleport(page, 200, 744, EAST);
    await holdKey(page, 'w', 900);
    await expect.poll(async () => (await getState(page)).abilities).toContain('dozer_blade');

    await teleport(page, 380, CORRIDOR_Y, EAST);
    p = await holdKey(page, 'w', 2_500);
    expect(p.x).toBeGreaterThan(470);
  });

  test('a boulder only moves for the dozer blade', async ({ page }) => {
    await enterWorld(page);
    const boulder = async () => (await getObjects(page)).boulders[0]!;
    const home = await boulder();
    await teleport(page, 100, 744, EAST);
    await holdKey(page, 'w', 2_000);
    expect((await boulder()).x).toBeCloseTo(home.x, 0);

    await grantAbility(page, 'dozer_blade');
    await teleport(page, 100, 744, EAST);
    await holdKey(page, 'w', 2_000);
    expect((await boulder()).x).toBeGreaterThan(home.x + 10);
  });

  test('the mortar lobs over the cliff onto its switch, which opens the door', async ({ page }) => {
    const errors = collectErrors(page);
    await enterWorld(page);
    await grantAbility(page, 'mortar');
    await teleport(page, 600, CORRIDOR_Y, NORTH);
    await holdKey(page, 'e', 100);
    await expect.poll(async () => (await getState(page)).selectedSecondary).toBe('mortar');
    const ammo = (await getState(page)).secondaryAmmo.mortar!;

    await pointMouseAt(page, 696, 584);
    await click(page, 'left');
    await expect.poll(() => getMortarLandings(page)).toHaveLength(1);
    const [landing] = await getMortarLandings(page);
    expect(landing!.level).toBe(1);
    expect(Math.hypot(landing!.x - 696, landing!.y - 584)).toBeLessThan(4);

    await expect
      .poll(async () => (await getObjects(page)).switches.find((s) => s.activatedBy === 'mortar'))
      .toMatchObject({ activated: true });
    expect((await getObjects(page)).doors.map((d) => d.key)).not.toContain(
      'test_x01_y02:door_mortar',
    );
    expect((await getState(page)).secondaryAmmo.mortar).toBe(ammo - 1);
    expect((await getState(page)).flags['test_x01_y02:sw_mortar']).toBe(true);

    // Through the open door.
    await teleport(page, 760, CORRIDOR_Y, EAST);
    const p = await holdKey(page, 'w', 2_000);
    expect(p.x).toBeGreaterThan(840);
    expect(errors).toEqual([]);
  });

  test('a closed door stops the tank; the cannon switch opens it', async ({ page }) => {
    await enterWorld(page);
    await teleport(page, 1150, CORRIDOR_Y, EAST);
    let p = await holdKey(page, 'w', 1_500);
    expect(p.x).toBeLessThan(1200 - 12);

    await teleport(page, 1000, CORRIDOR_Y, NORTH);
    await pointMouseAt(page, 1096, 584);
    await click(page, 'right');
    await expect.poll(async () => (await getShots(page)).gun_105).toBe(1);
    await expect
      .poll(async () => (await getObjects(page)).switches.find((s) => s.activatedBy === 'cannon'))
      .toMatchObject({ activated: true });

    await teleport(page, 1150, CORRIDOR_Y, EAST);
    p = await holdKey(page, 'w', 2_000);
    expect(p.x).toBeGreaterThan(1240);
  });
});

test.describe('depots and saves', () => {
  test('a depot heals and saves; death respawns there; a reload restores the game', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await enterWorld(page);
    await grantAbility(page, 'mortar');
    await teleport(page, 128, 608, EAST);
    await damagePlayer(page, 40);
    await expect.poll(async () => (await getPawn(page)).hp).toBe(MAX_HP - 40);
    await holdKey(page, 'w', 1_000);
    await expect.poll(async () => (await getPawn(page)).hp).toBe(MAX_HP);
    await expect
      .poll(async () => ((await getSave(page)) as { depotId?: string } | null)?.depotId)
      .toBe('test_x00_y02:depot_gallery');

    // Die somewhere else: back at the depot.
    await teleport(page, 300, CORRIDOR_Y, EAST);
    await damagePlayer(page, 999);
    await expect.poll(async () => (await getPawn(page)).alive).toBe(false);
    await expect.poll(async () => (await getPawn(page)).alive, { timeout: 10_000 }).toBe(true);
    const back = await getPawn(page);
    expect(Math.hypot(back.x - 160, back.y - 608)).toBeLessThan(2);

    // Reload: same slot, same depot, same abilities.
    await enterSlot(page, 1);
    const pawn = await getPawn(page);
    expect(Math.hypot(pawn.x - 160, pawn.y - 608)).toBeLessThan(2);
    const state = await getState(page);
    expect(state.depotId).toBe('test_x00_y02:depot_gallery');
    expect(state.abilities).toEqual(['mortar']);
    expect(errors).toEqual([]);
  });

  test('?slot=2 keeps its own save', async ({ page }) => {
    await enterSlot(page, 2);
    await teleport(page, 128, 608, EAST);
    await holdKey(page, 'w', 1_000);
    await expect.poll(() => getSave(page, 2)).not.toBeNull();
    expect(await getSave(page, 1)).toBeNull();
  });
});

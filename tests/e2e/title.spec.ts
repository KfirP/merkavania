import { expect, test, type Page } from '@playwright/test';
import { collectErrors, getMenu, isSceneActive, pressKey } from './helpers';

/** A minimal version-1 save with the mortar, 65 s played. */
const SAVE = {
  version: 1,
  updatedAt: new Date(2026, 9, 2, 12).getTime(),
  playtimeMs: 65_000,
  mk: 'mk2',
  abilities: ['mortar'],
  minor: { armor_plate: 0, ammo_rack: 0, repair_kit: 0 },
  selectedSecondary: 'coax_mg',
  secondaryAmmo: { mortar: 6 },
  depotId: null,
  flags: {},
  visitedChunks: {},
};

async function openTitle(page: Page, query = '') {
  await page.goto(`/?debug=1${query}`);
  await expect.poll(() => isSceneActive(page, 'Title')).toBe(true);
  await expect
    .poll(async () => (await getMenu(page, 'Title'))?.items.length ?? 0)
    .toBeGreaterThan(0);
}

async function seedSlot(page: Page, slot: number) {
  await page.evaluate(
    ([slot, save]) => localStorage.setItem(`merkavania.save.${slot}`, JSON.stringify(save)),
    [slot, SAVE] as const,
  );
}

async function labelOf(page: Page, id: string) {
  const menu = await getMenu(page, 'Title');
  return menu?.items.find((i) => i.id === id)?.label ?? null;
}

/** Moves the title menu's focus down until `id` is focused. */
async function focus(page: Page, id: string) {
  for (let i = 0; i < 10 && (await getMenu(page, 'Title'))?.focused !== id; i++)
    await pressKey(page, 'ArrowDown');
  expect((await getMenu(page, 'Title'))?.focused).toBe(id);
}

test.describe('title and slot select', () => {
  test('lists empty slots as new games and used slots with playtime and date', async ({ page }) => {
    const errors = collectErrors(page);
    await openTitle(page);
    await seedSlot(page, 2);
    await openTitle(page);
    expect(await labelOf(page, 'slot_1')).toContain('New game');
    const used = await labelOf(page, 'slot_2');
    expect(used).toContain('1:05');
    expect(used).toContain('2026-10-02');
    expect((await getMenu(page, 'Title'))?.focused).toBe('slot_1');
    expect(errors).toEqual([]);
  });

  test('continues the chosen slot', async ({ page }) => {
    await openTitle(page);
    await seedSlot(page, 2);
    await openTitle(page);
    await focus(page, 'slot_2');
    await pressKey(page, 'Enter');
    await expect.poll(() => isSceneActive(page, 'World')).toBe(true);
    await expect
      .poll(() => page.evaluate(() => window.__merkavania?.getState()?.abilities ?? null))
      .toEqual(['mortar']);
  });

  test('?slot=N focuses that slot', async ({ page }) => {
    await openTitle(page, '&slot=3');
    expect((await getMenu(page, 'Title'))?.focused).toBe('slot_3');
  });

  test('deletes a save only after confirming', async ({ page }) => {
    await openTitle(page);
    await seedSlot(page, 2);
    await openTitle(page);
    await focus(page, 'delete');
    await pressKey(page, 'Enter');
    // Only used slots are offered.
    const pick = await getMenu(page, 'Title');
    expect(pick?.items.filter((i) => !i.disabled).map((i) => i.id)).toEqual(['slot_2', 'back']);
    await pressKey(page, 'Enter');
    expect((await getMenu(page, 'Title'))?.items.map((i) => i.id)).toEqual(['no', 'yes']);
    // "No" is focused first: Enter keeps the save.
    await pressKey(page, 'Enter');
    expect(await page.evaluate(() => localStorage.getItem('merkavania.save.2'))).not.toBeNull();
    await focus(page, 'delete');
    await pressKey(page, 'Enter');
    await pressKey(page, 'Enter');
    await pressKey(page, 'ArrowDown');
    await pressKey(page, 'Enter');
    expect(await page.evaluate(() => localStorage.getItem('merkavania.save.2'))).toBeNull();
    expect(await labelOf(page, 'slot_2')).toContain('New game');
  });

  test('switches to Hebrew and remembers it', async ({ page }) => {
    await openTitle(page);
    await focus(page, 'language');
    await pressKey(page, 'ArrowRight');
    await expect.poll(() => labelOf(page, 'slot_1')).toContain('משחק חדש');
    expect((await getMenu(page, 'Title'))?.focused).toBe('language');
    await openTitle(page);
    expect(await labelOf(page, 'slot_1')).toContain('משחק חדש');
  });

  test('a tap starts a slot', async ({ page }) => {
    await openTitle(page);
    const box = await page.evaluate(() => window.__merkavania?.getMenu('Title')?.rects[0] ?? null);
    expect(box).not.toBeNull();
    const canvas = (await page.locator('canvas').boundingBox())!;
    await page.mouse.click(
      canvas.x + canvas.width * (box!.x + box!.width / 2),
      canvas.y + canvas.height * (box!.y + box!.height / 2),
    );
    await expect.poll(() => isSceneActive(page, 'World')).toBe(true);
  });
});

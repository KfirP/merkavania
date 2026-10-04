import { expect, test, type Page } from '@playwright/test';
import { collectErrors, getMenu, isSceneActive, pressKey } from './helpers';

interface StoredSettings {
  volume: Record<string, number>;
  keybinds: Record<string, string[]>;
}

function storedSettings(page: Page) {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem('merkavania.settings') ?? 'null') as StoredSettings,
  );
}

/** Presses ArrowDown in `scene`'s menu until `id` is focused. */
async function focus(page: Page, scene: string, id: string) {
  for (let i = 0; i < 16 && (await getMenu(page, scene))?.focused !== id; i++)
    await pressKey(page, 'ArrowDown');
  expect((await getMenu(page, scene))?.focused).toBe(id);
}

async function openSettings(page: Page) {
  await page.goto('/?debug=1&world=test');
  await expect.poll(async () => (await getMenu(page, 'Title'))?.focused ?? null).toBe('slot_1');
  await focus(page, 'Title', 'settings');
  await pressKey(page, 'Enter');
  await expect.poll(() => isSceneActive(page, 'Settings')).toBe(true);
}

test.describe('settings', () => {
  test('a slider change is saved at once and Back returns to the title', async ({ page }) => {
    const errors = collectErrors(page);
    await openSettings(page);
    await focus(page, 'Settings', 'volume_music');
    await pressKey(page, 'ArrowLeft');
    await pressKey(page, 'ArrowLeft');
    expect((await storedSettings(page)).volume).toEqual({ master: 1, sfx: 1, music: 0.8 });
    // The title stays paused underneath: its menu doesn't move.
    expect((await getMenu(page, 'Title'))?.focused).toBe('settings');
    await pressKey(page, 'Escape');
    await expect.poll(() => isSceneActive(page, 'Settings')).toBe(false);
    expect(await isSceneActive(page, 'Title')).toBe(true);
    expect(errors).toEqual([]);
  });

  test('rebinds a key, takes it from its old action, and Esc cancels a capture', async ({
    page,
  }) => {
    await openSettings(page);
    await focus(page, 'Settings', 'controls');
    await pressKey(page, 'Enter');
    await focus(page, 'Settings', 'throttle_back');
    await pressKey(page, 'Enter');
    await pressKey(page, 'KeyE');
    const binds = (await storedSettings(page)).keybinds;
    expect(binds.throttle_back).toEqual(['E', 'DOWN']);
    expect(binds.cycle_next).toEqual([]);

    await pressKey(page, 'Enter');
    await pressKey(page, 'Escape');
    expect((await storedSettings(page)).keybinds.throttle_back).toEqual(['E', 'DOWN']);
    // Still in the controls list after the cancel.
    expect(await isSceneActive(page, 'Settings')).toBe(true);
    await focus(page, 'Settings', 'reset');
    await pressKey(page, 'Enter');
    expect((await storedSettings(page)).keybinds.cycle_next).toEqual(['E']);
  });

  test('switching language in settings re-renders both screens in Hebrew', async ({ page }) => {
    await openSettings(page);
    await pressKey(page, 'ArrowRight');
    await expect
      .poll(async () => (await getMenu(page, 'Settings'))?.items[0]?.label ?? '')
      .toContain('שפה');
    expect((await getMenu(page, 'Settings'))?.focused).toBe('language');
    await pressKey(page, 'Escape');
    await expect
      .poll(async () => (await getMenu(page, 'Title'))?.items[0]?.label ?? '')
      .toContain('משחק חדש');
  });
});

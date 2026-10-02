import { expect, test, type Page } from '@playwright/test';
import {
  collectErrors,
  enterWorld,
  getMenu,
  getPawn,
  holdKey,
  isSceneActive,
  pressKey,
  teleport,
} from './helpers';

const EAST = 0;
/** An open stretch of the test world's bottom corridor. */
const START = { x: 300, y: 680 };

function isPaused(page: Page, key: string) {
  return page.evaluate((k) => window.__merkavania?.game.scene.isPaused(k) ?? false, key);
}

async function focus(page: Page, scene: string, id: string) {
  for (let i = 0; i < 16 && (await getMenu(page, scene))?.focused !== id; i++)
    await pressKey(page, 'ArrowDown');
  expect((await getMenu(page, scene))?.focused).toBe(id);
}

async function pause(page: Page) {
  await pressKey(page, 'Escape');
  await expect.poll(() => isSceneActive(page, 'Pause')).toBe(true);
  await expect.poll(() => isPaused(page, 'World')).toBe(true);
}

test.describe('pause menu', () => {
  test('Esc pauses the world and Esc resumes it, without pausing again', async ({ page }) => {
    const errors = collectErrors(page);
    await enterWorld(page);
    await teleport(page, START.x, START.y, EAST);
    await pause(page);
    const before = await getPawn(page);
    await holdKey(page, 'w', 400);
    // Telemetry stops with the world, so check the world really didn't step.
    expect((await getPawn(page)).x).toBe(before.x);

    await pressKey(page, 'Escape');
    await expect.poll(() => isSceneActive(page, 'Pause')).toBe(false);
    await page.waitForTimeout(300);
    expect(await isPaused(page, 'World')).toBe(false);
    const moved = await holdKey(page, 'w', 500);
    expect(moved.x).toBeGreaterThan(before.x + 5);
    expect(errors).toEqual([]);
  });

  test('Resume closes it from the menu', async ({ page }) => {
    await enterWorld(page);
    await pause(page);
    expect((await getMenu(page, 'Pause'))?.focused).toBe('resume');
    await pressKey(page, 'Enter');
    await expect.poll(() => isPaused(page, 'World')).toBe(false);
  });

  test('Quit to title ends the run and a new one starts cleanly', async ({ page }) => {
    const errors = collectErrors(page);
    await enterWorld(page);
    await pause(page);
    await focus(page, 'Pause', 'quit');
    await pressKey(page, 'Enter');
    await expect.poll(() => isSceneActive(page, 'Title')).toBe(true);
    for (const key of ['World', 'Hud', 'Pause', 'Debug'])
      expect(await isSceneActive(page, key), key).toBe(false);
    await pressKey(page, 'Enter');
    await expect.poll(() => isSceneActive(page, 'World')).toBe(true);
    await expect.poll(() => isSceneActive(page, 'Hud')).toBe(true);
    await teleport(page, START.x, START.y, EAST);
    expect((await holdKey(page, 'w', 500)).x).toBeGreaterThan(START.x + 5);
    expect(errors).toEqual([]);
  });

  test('a key rebound in settings drives the tank after resuming', async ({ page }) => {
    await enterWorld(page);
    await teleport(page, START.x, START.y, EAST);
    await pause(page);
    await focus(page, 'Pause', 'settings');
    await pressKey(page, 'Enter');
    await expect.poll(() => isSceneActive(page, 'Settings')).toBe(true);
    await focus(page, 'Settings', 'controls');
    await pressKey(page, 'Enter');
    await pressKey(page, 'Enter'); // Forward
    await pressKey(page, 'KeyI');
    await pressKey(page, 'Escape'); // back to the settings list
    await pressKey(page, 'Escape'); // close settings
    await expect.poll(() => isSceneActive(page, 'Settings')).toBe(false);
    await pressKey(page, 'Escape'); // resume
    await expect.poll(() => isPaused(page, 'World')).toBe(false);
    expect((await holdKey(page, 'i', 500)).x).toBeGreaterThan(START.x + 5);
    // W is no longer forward.
    const at = await teleport(page, START.x, START.y, EAST);
    expect((await holdKey(page, 'w', 400)).x).toBeCloseTo(at.x, 0);
  });
});

import { expect, test, type Page } from '@playwright/test';
import { collectErrors, isSceneActive, tapKey, teleport } from './helpers';

/**
 * Radio messages (M7): the desert's intro radio covers the start spawn, so a new game opens with
 * Command on the line. Messages type out on the HUD; Space finishes the typing, then skips.
 */
const TILE = 16;
const NORTH = -Math.PI / 2;
const INTRO_EN = "Tiger-1, this is Command. You're cut off. Head east";

function radio(page: Page) {
  return page.evaluate(() => window.__merkavania?.getHud()?.radio ?? null);
}

async function newDesertGame(page: Page) {
  await page.goto('/?debug=1');
  await expect.poll(() => isSceneActive(page, 'Title')).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => isSceneActive(page, 'Hud')).toBe(true);
}

test.describe('radio', () => {
  test('the intro plays at the start, types out, and Space skips it', async ({ page }) => {
    const errors = collectErrors(page);
    await newDesertGame(page);
    await expect.poll(async () => (await radio(page))?.messageKey).toBe('radio.desert.intro');
    expect((await radio(page))!.speaker).toBe('command');
    await expect.poll(async () => (await radio(page))?.shown ?? '').toContain(INTRO_EN);

    // Once it's fully typed, one press moves on (nothing else is queued).
    await expect
      .poll(async () => (await radio(page))?.shown ?? '')
      .toContain('Try not to dent it.');
    await tapKey(page, 'Space');
    await expect.poll(() => radio(page)).toBeNull();
    expect(errors).toEqual([]);
  });

  test('a once message is saved as heard and does not play again', async ({ page }) => {
    await newDesertGame(page);
    await expect.poll(async () => (await radio(page))?.messageKey).toBe('radio.desert.intro');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const save = window.__merkavania?.getSave(1) as { flags?: Record<string, boolean> };
          return save?.flags?.['desert_x00_y02:radio_intro'] ?? false;
        }),
      )
      .toBe(true);

    // Continue the slot: back at the start, inside the trigger, and Command stays quiet.
    await page.goto('/?debug=1&slot=1');
    await expect.poll(() => isSceneActive(page, 'Title')).toBe(true);
    await page.keyboard.press('Enter');
    await expect.poll(() => isSceneActive(page, 'Hud')).toBe(true);
    await page.waitForTimeout(500);
    expect(await radio(page)).toBeNull();
  });

  test('driving into a trigger plays its message; in Hebrew it reads right to left', async ({
    page,
  }) => {
    await page.goto('/?debug=1');
    await page.evaluate(() =>
      localStorage.setItem('merkavania.settings', JSON.stringify({ language: 'he' })),
    );
    await newDesertGame(page);
    await expect.poll(async () => (await radio(page))?.messageKey).toBe('radio.desert.intro');
    // Space until it's gone (the first press may only finish the typing).
    await expect
      .poll(async () => {
        await tapKey(page, 'Space');
        await page.waitForTimeout(50);
        return radio(page);
      })
      .toBeNull();
    // The hatch radio at the ridge foot (x00_y01).
    await teleport(page, 12 * TILE, 31 * TILE, NORTH);
    await expect.poll(async () => (await radio(page))?.messageKey).toBe('radio.desert.hatch');
    await expect.poll(async () => (await radio(page))?.shown ?? '').toContain('הדלת האחורית');
  });
});

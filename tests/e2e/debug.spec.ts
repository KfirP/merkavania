import { expect, test } from '@playwright/test';
import { enterWorld, getPawn, isSceneActive } from './helpers';

test.describe('debug overlay', () => {
  test('launches with the world; backtick hides it and 1 toggles physics bodies', async ({
    page,
  }) => {
    await enterWorld(page);
    expect(await isSceneActive(page, 'Debug')).toBe(true);

    const overlayVisible = () =>
      page.evaluate(() => {
        const text = window.__merkavania!.game.scene.getScene('Debug').children.list[0];
        return (text as unknown as { visible: boolean }).visible;
      });
    const bodiesDrawn = () =>
      page.evaluate(
        () => window.__merkavania!.game.scene.getScene('World').physics.world.drawDebug,
      );

    expect(await overlayVisible()).toBe(true);
    expect(await bodiesDrawn()).toBe(false);

    await page.keyboard.press('1');
    await expect.poll(bodiesDrawn).toBe(true);
    await page.keyboard.press('1');
    await expect.poll(bodiesDrawn).toBe(false);

    await page.keyboard.press('Backquote');
    await expect.poll(overlayVisible).toBe(false);
    // Bodies can't be toggled while the overlay is hidden.
    await page.keyboard.press('1');
    await page.waitForTimeout(100);
    expect(await bodiesDrawn()).toBe(false);
    await page.keyboard.press('Backquote');
    await expect.poll(overlayVisible).toBe(true);
  });

  test('toggles once per press even when several key events land in one frame', async ({
    page,
  }) => {
    await enterWorld(page);
    // Phaser re-dispatches its whole per-frame key queue on every DOM key event, so event-based
    // listeners would see earlier presses again. Dispatch synchronously to share one frame.
    const state = await page.evaluate(() => {
      const fire = (type: string, key: string, code: string, keyCode: number) =>
        window.dispatchEvent(new KeyboardEvent(type, { key, code, keyCode, bubbles: true }));
      for (const [key, code, keyCode] of [
        ['1', 'Digit1', 49],
        ['`', 'Backquote', 192],
      ] as const) {
        fire('keydown', key, code, keyCode);
        fire('keyup', key, code, keyCode);
      }
      return new Promise<{ overlay: boolean; bodies: boolean }>((resolve) =>
        setTimeout(() => {
          const game = window.__merkavania!.game;
          const text = game.scene.getScene('Debug').children.list[0] as unknown as {
            visible: boolean;
          };
          resolve({
            overlay: text.visible,
            bodies: game.scene.getScene('World').physics.world.drawDebug,
          });
        }, 200),
      );
    });
    expect(state).toEqual({ overlay: false, bodies: true });
  });

  test('exposes pawn telemetry through window.__merkavania', async ({ page }) => {
    await enterWorld(page);
    const pawn = await getPawn(page);
    expect(pawn).toMatchObject({
      x: 480,
      device: 'keyboardMouse',
      level: 0,
      chunk: 'test_x01_y01',
    });
    expect(pawn.heading).toBeCloseTo(-Math.PI / 2);
  });
});

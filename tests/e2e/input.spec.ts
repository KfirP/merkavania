import { expect, test } from '@playwright/test';
import { collectErrors, enterWorld, getPawn, getShots, isSceneActive } from './helpers';

test.describe('gamepad', () => {
  test.beforeEach(async ({ page }) => {
    // A fake standard-mapping pad; Phaser polls navigator.getGamepads() every frame.
    await page.addInitScript(() => {
      const buttons = Array.from({ length: 17 }, () => ({
        pressed: false,
        touched: false,
        value: 0,
      }));
      const pad = {
        id: 'test pad',
        index: 0,
        connected: true,
        mapping: 'standard',
        timestamp: 0,
        axes: [0, 0, 0, 0],
        buttons,
      };
      (window as unknown as { __pad: typeof pad }).__pad = pad;
      navigator.getGamepads = () => [pad as unknown as Gamepad, null, null, null];
    });
  });

  test('left stick drives, right stick aims, RT fires, and it takes over from the mouse', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await enterWorld(page);
    expect((await getPawn(page)).device).toBe('keyboardMouse');
    const start = await getPawn(page);

    await page.evaluate(() => {
      const pad = (
        window as unknown as { __pad: { axes: number[]; buttons: unknown[]; timestamp: number } }
      ).__pad;
      pad.axes = [0, -1, 0, 1]; // full forward, aim south
      pad.buttons[7] = { pressed: true, touched: true, value: 1 }; // RT
      // Phaser ignores samples older than the pad object; real pads use performance.now().
      pad.timestamp = performance.now() + 1e6;
    });
    await page.waitForTimeout(1_000);

    const pawn = await getPawn(page);
    expect(pawn.device).toBe('gamepad');
    expect(pawn.y).toBeLessThan(start.y - 10);
    await expect.poll(async () => (await getPawn(page)).turretAngle).toBeCloseTo(Math.PI / 2, 1);
    expect((await getShots(page)).gun_105).toBeGreaterThanOrEqual(1);
    expect(errors).toEqual([]);
  });
});

test.describe('touch', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 960, height: 540 } });

  test('controls stay hidden until the first touch, then the sticks drive, aim and fire', async ({
    page,
    context,
  }) => {
    const errors = collectErrors(page);
    await page.goto('/?debug=1');
    await expect.poll(() => isSceneActive(page, 'Title')).toBe(true);
    await page.keyboard.press('Enter');
    await expect.poll(() => isSceneActive(page, 'TouchControls')).toBe(true);
    const controlsVisible = () =>
      page.evaluate(
        () => window.__merkavania!.game.scene.getScene('TouchControls').cameras.main.visible,
      );
    expect(await controlsVisible()).toBe(false);
    const start = await getPawn(page);

    // The canvas is 2x (960×540 for 480×270). Left thumb pushes up, right thumb pushes east fully.
    const cdp = await context.newCDPSession(page);
    const touch = (type: string, touchPoints: { x: number; y: number; id: number }[]) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints } as never);
    await touch('touchStart', [{ x: 120, y: 440, id: 1 }]);
    expect(await controlsVisible()).toBe(true);
    await touch('touchMove', [{ x: 120, y: 360, id: 1 }]);
    await touch('touchStart', [
      { x: 120, y: 360, id: 1 },
      { x: 800, y: 440, id: 2 },
    ]);
    for (let i = 0; i < 10; i++) {
      await touch('touchMove', [
        { x: 120, y: 360 + (i % 2), id: 1 },
        { x: 900, y: 440 + (i % 2), id: 2 },
      ]);
      await page.waitForTimeout(100);
    }
    const pawn = await getPawn(page);
    await touch('touchEnd', []);

    expect(pawn.device).toBe('touch');
    expect(pawn.y).toBeLessThan(start.y - 10);
    expect(pawn.turretAngle).toBeCloseTo(0, 1);
    expect((await getShots(page)).gun_105).toBeGreaterThanOrEqual(1);
    expect(errors).toEqual([]);
  });
});

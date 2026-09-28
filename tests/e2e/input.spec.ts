import { expect, test, type BrowserContext, type Page } from '@playwright/test';
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

/**
 * Multi-finger touch over CDP. The canvas is 2x (960×540 for 480×270), so page px = 2 × game px.
 * Every event carries all fingers still down; lifting sends the remaining ones.
 */
async function fingers(page: Page, context: BrowserContext) {
  const cdp = await context.newCDPSession(page);
  const down = new Map<number, { x: number; y: number }>();
  const points = () => [...down].map(([id, p]) => ({ id, ...p }));
  const send = (type: string, touchPoints = points()) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints } as never);
  return {
    async down(id: number, x: number, y: number) {
      down.set(id, { x, y });
      await send('touchStart');
    },
    async move(id: number, x: number, y: number) {
      down.set(id, { x, y });
      await send('touchMove');
    },
    async up(id: number) {
      down.delete(id);
      await send('touchEnd', []);
      // CDP ends every touch on touchEnd; put the fingers still held back down.
      if (down.size) await send('touchStart');
    },
    async tap(id: number, x: number, y: number) {
      await this.down(id, x, y);
      await this.up(id);
    },
  };
}

// Right stick base where the thumb lands; the stick radius is 28 game px = 56 page px.
const RIGHT = { x: 800, y: 440 };
const STICK_PX = 56;
const LEFT = { x: 120, y: 440 };
const ALT_BUTTON = { x: 900, y: 320 };

async function enterTouchWorld(page: Page) {
  await page.goto('/?debug=1');
  await expect.poll(() => isSceneActive(page, 'Title')).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => isSceneActive(page, 'TouchControls')).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__merkavania?.getPawn() != null)).toBe(true);
}

test.describe('touch', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 960, height: 540 } });

  test('controls appear on the first touch; the right stick aims without firing and lifting fires once', async ({
    page,
    context,
  }) => {
    const errors = collectErrors(page);
    await enterTouchWorld(page);
    const controlsVisible = () =>
      page.evaluate(
        () => window.__merkavania!.game.scene.getScene('TouchControls').cameras.main.visible,
      );
    expect(await controlsVisible()).toBe(false);

    const f = await fingers(page, context);
    await f.down(2, RIGHT.x, RIGHT.y);
    expect(await controlsVisible()).toBe(true);
    await f.move(2, RIGHT.x + STICK_PX + 20, RIGHT.y);
    await expect.poll(async () => (await getPawn(page)).turretAngle).toBeCloseTo(0, 1);
    await page.waitForTimeout(300);
    expect(await getShots(page)).toEqual({});
    expect((await getPawn(page)).device).toBe('touch');

    await f.up(2);
    await expect.poll(() => getShots(page)).toEqual({ gun_105: 1 });
    await page.waitForTimeout(1_000);
    expect(await getShots(page)).toEqual({ gun_105: 1 });
    expect(errors).toEqual([]);
  });

  test('dragging back to the centre before lifting cancels the shot but keeps the aim', async ({
    page,
    context,
  }) => {
    await enterTouchWorld(page);
    const f = await fingers(page, context);
    await f.down(2, RIGHT.x, RIGHT.y);
    await f.move(2, RIGHT.x + STICK_PX, RIGHT.y);
    await expect.poll(async () => (await getPawn(page)).turretAngle).toBeCloseTo(0, 1);
    await f.move(2, RIGHT.x + 5, RIGHT.y);
    await f.up(2);
    await page.waitForTimeout(800);
    expect(await getShots(page)).toEqual({});
    expect((await getPawn(page)).turretAngle).toBeCloseTo(0, 1);
  });

  test('with MG mode on, the outer ring fires the coax while driving; lifting still fires the cannon', async ({
    page,
    context,
  }) => {
    const errors = collectErrors(page);
    await enterTouchWorld(page);
    const start = await getPawn(page);
    const f = await fingers(page, context);
    await f.tap(3, ALT_BUTTON.x, ALT_BUTTON.y);

    // Left thumb drives forward the whole time.
    await f.down(1, LEFT.x, LEFT.y);
    await f.move(1, LEFT.x, LEFT.y - STICK_PX);

    // Halfway: aims, no MG.
    await f.down(2, RIGHT.x, RIGHT.y);
    await f.move(2, RIGHT.x + STICK_PX / 2, RIGHT.y);
    await page.waitForTimeout(500);
    expect(await getShots(page)).toEqual({});

    // Rim: the MG fires.
    await f.move(2, RIGHT.x + STICK_PX, RIGHT.y);
    await expect.poll(async () => (await getShots(page)).coax_mg ?? 0).toBeGreaterThan(3);
    expect((await getPawn(page)).y).toBeLessThan(start.y - 10);

    // Back inside the ring: the MG stops.
    await f.move(2, RIGHT.x + STICK_PX / 2, RIGHT.y);
    await page.waitForTimeout(150);
    const coax = (await getShots(page)).coax_mg!;
    await page.waitForTimeout(500);
    expect((await getShots(page)).coax_mg).toBe(coax);

    // Lifting fires the cannon; no main-gun shots happened before that.
    expect((await getShots(page)).gun_105).toBeUndefined();
    await f.up(2);
    await expect.poll(async () => (await getShots(page)).gun_105).toBe(1);
    expect(errors).toEqual([]);
  });

  test('with MG mode off, a full drag never fires the coax', async ({ page, context }) => {
    await enterTouchWorld(page);
    const f = await fingers(page, context);
    await f.down(2, RIGHT.x, RIGHT.y);
    await f.move(2, RIGHT.x + STICK_PX + 20, RIGHT.y);
    await page.waitForTimeout(800);
    expect((await getShots(page)).coax_mg).toBeUndefined();
  });
});

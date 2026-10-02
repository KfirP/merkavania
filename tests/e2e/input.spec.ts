import { expect, test, type Page } from '@playwright/test';
import {
  collectErrors,
  enterWorld,
  getMortarLandings,
  getPawn,
  getShots,
  grantAbility,
  fingers,
  isSceneActive,
} from './helpers';

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

// Right stick base where the thumb lands; the stick radius is 28 game px = 56 page px.
const RIGHT = { x: 800, y: 440 };
const STICK_PX = 56;
const LEFT = { x: 120, y: 440 };
const ALT_BUTTON = { x: 900, y: 320 };
// Left of ALT, shown once the tank has the mortar.
const MORTAR_BUTTON = { x: 820, y: 320 };
// Above ALT, shown once the tank has the scout.
const HATCH_BUTTON = { x: 900, y: 240 };

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

  test('with MG mode on, the outer ring fires the coax while driving and lifting never fires the cannon', async ({
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

    // MG mode switches the stick away from the cannon: lifting, from the ring or the rim, fires nothing.
    await f.up(2);
    await f.down(2, RIGHT.x, RIGHT.y);
    await f.move(2, RIGHT.x + STICK_PX, RIGHT.y);
    await page.waitForTimeout(200);
    await f.up(2);
    await page.waitForTimeout(1_000);
    expect((await getShots(page)).gun_105).toBeUndefined();

    // Toggling MG mode off switches back to the cannon.
    await f.tap(3, ALT_BUTTON.x, ALT_BUTTON.y);
    await f.down(2, RIGHT.x, RIGHT.y);
    await f.move(2, RIGHT.x + STICK_PX, RIGHT.y);
    await page.waitForTimeout(200);
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

  test('the mortar button appears with the mortar; dragging from it lobs a shell where the finger lifts', async ({
    page,
    context,
  }) => {
    const errors = collectErrors(page);
    await enterTouchWorld(page);
    const buttonVisible = () =>
      page.evaluate(() => {
        const scene = window.__merkavania!.game.scene.getScene('TouchControls') as unknown as {
          mortarButton: { visible: boolean };
        };
        return scene.mortarButton.visible;
      });
    expect(await buttonVisible()).toBe(false);
    await grantAbility(page, 'mortar');
    await expect.poll(buttonVisible).toBe(true);

    const f = await fingers(page, context);
    // A tap on the button fires nothing.
    await f.tap(3, MORTAR_BUTTON.x, MORTAR_BUTTON.y);
    await page.waitForTimeout(300);
    expect(await getMortarLandings(page)).toEqual([]);

    // Drag out and back onto the button: cancelled.
    await f.down(3, MORTAR_BUTTON.x, MORTAR_BUTTON.y);
    await f.move(3, MORTAR_BUTTON.x - 200, MORTAR_BUTTON.y - 100);
    await page.waitForTimeout(100);
    await f.move(3, MORTAR_BUTTON.x, MORTAR_BUTTON.y);
    await page.waitForTimeout(100);
    await f.up(3);
    await page.waitForTimeout(300);
    expect(await getMortarLandings(page)).toEqual([]);

    // Drag to a spot and lift: the shell lands there. Page px are 2 × game px.
    const lift = { x: MORTAR_BUTTON.x - 300, y: MORTAR_BUTTON.y - 200 };
    const target = await page.evaluate(
      ([x, y]) => {
        const cam = window.__merkavania!.game.scene.getScene('World').cameras.main;
        const p = cam.getWorldPoint(x! / 2, y! / 2);
        return { x: p.x, y: p.y };
      },
      [lift.x, lift.y],
    );
    await f.down(3, MORTAR_BUTTON.x, MORTAR_BUTTON.y);
    await f.move(3, lift.x, lift.y);
    await page.waitForTimeout(100);
    await f.up(3);
    await expect.poll(() => getMortarLandings(page)).toHaveLength(1);
    const [landing] = await getMortarLandings(page);
    expect(Math.hypot(landing!.x - target.x, landing!.y - target.y)).toBeLessThan(4);
    expect((await getShots(page)).gun_105).toBeUndefined();
    expect(errors).toEqual([]);
  });
});

test.describe('touch hatch', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 960, height: 540 } });

  test('the hatch button appears with the scout; a tap deploys it and another recalls it', async ({
    page,
    context,
  }) => {
    const errors = collectErrors(page);
    await enterTouchWorld(page);
    const buttonVisible = () =>
      page.evaluate(() => {
        const scene = window.__merkavania!.game.scene.getScene('TouchControls') as unknown as {
          hatchButton: { visible: boolean };
        };
        return scene.hatchButton.visible;
      });
    expect(await buttonVisible()).toBe(false);
    await grantAbility(page, 'hatch_scout');
    await expect.poll(buttonVisible).toBe(true);

    const f = await fingers(page, context);
    await f.tap(3, HATCH_BUTTON.x, HATCH_BUTTON.y);
    await expect.poll(async () => (await getPawn(page)).kind).toBe('scout');
    // The left stick walks the scout 8-way: straight right.
    const start = await getPawn(page);
    await f.down(1, LEFT.x, LEFT.y);
    await f.move(1, LEFT.x + STICK_PX, LEFT.y);
    await page.waitForTimeout(600);
    await f.up(1);
    const moved = await getPawn(page);
    expect(moved.x).toBeGreaterThan(start.x + 20);
    expect(Math.abs(moved.y - start.y)).toBeLessThan(2);

    await f.tap(3, HATCH_BUTTON.x, HATCH_BUTTON.y);
    await expect.poll(async () => (await getPawn(page)).kind, { timeout: 8_000 }).toBe('tank');
    expect(errors).toEqual([]);
  });
});

test.describe('gamepad mortar and hatch', () => {
  test.beforeEach(async ({ page }) => {
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

  /** Sets the stub pad's axes and pressed buttons (by index) and marks it fresh. */
  const setPad = (page: Page, axes: number[], pressed: number[]) =>
    page.evaluate(
      ([axes, pressed]) => {
        const pad = (
          window as unknown as {
            __pad: { axes: number[]; buttons: unknown[]; timestamp: number };
          }
        ).__pad;
        pad.axes = axes;
        pad.buttons = pad.buttons.map((_, i) => {
          const on = pressed.includes(i);
          return { pressed: on, touched: on, value: on ? 1 : 0 };
        });
        pad.timestamp = performance.now() + 1e6;
      },
      [axes, pressed] as const,
    );

  test('RB selects the mortar and right-stick tilt sets its range for LT', async ({ page }) => {
    await enterWorld(page);
    await grantAbility(page, 'mortar');
    const RB = 5;
    const LT = 6;
    await setPad(page, [0, 0, 0, 0], [RB]);
    await page.waitForTimeout(150);
    await setPad(page, [0, 0, 0, 0], []);
    await expect
      .poll(() => page.evaluate(() => window.__merkavania!.getState()!.selectedSecondary))
      .toBe('mortar');

    // Full tilt east: full range.
    const pawn = await getPawn(page);
    await setPad(page, [0, 0, 1, 0], [LT]);
    await page.waitForTimeout(150);
    await setPad(page, [0, 0, 1, 0], []);
    await expect.poll(() => getMortarLandings(page)).toHaveLength(1);
    const [landing] = await getMortarLandings(page);
    expect(landing!.x - pawn.x).toBeCloseTo(220, 0);
    expect(landing!.y - pawn.y).toBeCloseTo(0, 0);
  });

  test('Y opens the rear hatch', async ({ page }) => {
    await enterWorld(page);
    await grantAbility(page, 'hatch_scout');
    const Y = 3;
    await setPad(page, [0, 0, 0, 0], [Y]);
    await page.waitForTimeout(150);
    await setPad(page, [0, 0, 0, 0], []);
    await expect.poll(async () => (await getPawn(page)).kind).toBe('scout');
  });
});

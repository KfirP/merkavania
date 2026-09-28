import Phaser from 'phaser';
import { stickMagnitude } from '../../logic/input/stick';
import { TOUCH_MG_THRESHOLD, touchAimZone, type TouchAimZone } from '../../logic/input/touchAim';
import { dragToStick } from '../../logic/input/virtualStick';
import { GAME_HEIGHT, GAME_WIDTH } from '../../logic/scale';
import { touchState, type StickState } from '../input/touchState';
import { SceneKey } from './keys';

const STICK_RADIUS = 28;
const KNOB_RADIUS = 11;
const ALT_BUTTON = { x: GAME_WIDTH - 30, y: GAME_HEIGHT - 110, r: 16 };
const IDLE_ALPHA = 0.25;
const ALT_COLOR = 0xffb030;
/** Right knob colour per zone: grey = release cancels, orange = release fires, yellow = MG. */
const ZONE_COLOR: Record<TouchAimZone, number> = {
  cancel: 0xffffff,
  armed: 0xff8c1a,
  mg: 0xffe040,
};

interface VirtualStick {
  state: StickState;
  pointerId: number | null;
  base: Phaser.GameObjects.Arc;
  knob: Phaser.GameObjects.Arc;
  home: { x: number; y: number };
}

/**
 * Dual floating virtual sticks: each appears where the thumb lands in its half of the screen.
 * Left drives the hull. Right aims; lifting it fires the cannon, and dragging back to the centre
 * first cancels. The ALT button toggles MG mode, in which the right stick's outer ring (shown
 * only in MG mode) fires the coax. Writes `touchState` for TouchAdapter; rules in touchAim.ts.
 * Always running but hidden until the first real touch: many desktop browsers report touch
 * support, and a touchscreen laptop may never be touched.
 */
export class TouchControlsScene extends Phaser.Scene {
  private sticks!: { left: VirtualStick; right: VirtualStick };
  private altButton!: Phaser.GameObjects.Arc;
  private mgRing!: Phaser.GameObjects.Arc;

  constructor() {
    super(SceneKey.TouchControls);
  }

  create(): void {
    this.input.addPointer(2);
    this.sticks = {
      left: this.makeStick(touchState.left, 60, GAME_HEIGHT - 60),
      right: this.makeStick(touchState.right, GAME_WIDTH - 60, GAME_HEIGHT - 60),
    };
    this.altButton = this.add
      .circle(ALT_BUTTON.x, ALT_BUTTON.y, ALT_BUTTON.r, ALT_COLOR, IDLE_ALPHA)
      .setStrokeStyle(1, 0xffffff, 0.6);
    const right = this.sticks.right;
    this.mgRing = this.add
      .circle(right.home.x, right.home.y, STICK_RADIUS * TOUCH_MG_THRESHOLD)
      .setStrokeStyle(1, ZONE_COLOR.mg, 0.5)
      .setVisible(false);
    this.refreshMgMode();
    this.cameras.main.setVisible(false);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const s of Object.values(this.sticks)) this.release(s);
      touchState.mgOn = false;
    });
  }

  private makeStick(state: StickState, x: number, y: number): VirtualStick {
    const base = this.add
      .circle(x, y, STICK_RADIUS, 0xffffff, 0.12)
      .setStrokeStyle(1, 0xffffff, 0.4);
    const knob = this.add.circle(x, y, KNOB_RADIUS, 0xffffff, IDLE_ALPHA);
    return { state, pointerId: null, base, knob, home: { x, y } };
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (!p.wasTouch) return;
    touchState.lastTouchAt = performance.now();
    this.cameras.main.setVisible(true);
    if (Phaser.Math.Distance.Between(p.x, p.y, ALT_BUTTON.x, ALT_BUTTON.y) <= ALT_BUTTON.r + 4) {
      touchState.mgOn = !touchState.mgOn;
      this.refreshMgMode();
      return;
    }
    const stick = p.x < GAME_WIDTH / 2 ? this.sticks.left : this.sticks.right;
    if (stick.pointerId !== null) return;
    stick.pointerId = p.id;
    stick.state.active = true;
    stick.base.setPosition(p.x, p.y);
    stick.knob.setPosition(p.x, p.y).setAlpha(0.5);
    if (stick === this.sticks.right) this.mgRing.setPosition(p.x, p.y);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!p.wasTouch) return;
    touchState.lastTouchAt = performance.now();
    for (const stick of Object.values(this.sticks)) {
      if (stick.pointerId !== p.id) continue;
      const s = dragToStick(p.x - stick.base.x, p.y - stick.base.y, STICK_RADIUS);
      stick.knob.setPosition(stick.base.x + s.knobX, stick.base.y + s.knobY);
      stick.state.x = s.x;
      stick.state.y = s.y;
      if (stick === this.sticks.right)
        stick.knob.setFillStyle(
          ZONE_COLOR[touchAimZone(stickMagnitude(s.x, s.y), touchState.mgOn)],
        );
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (!p.wasTouch) return;
    touchState.lastTouchAt = performance.now();
    for (const stick of Object.values(this.sticks))
      if (stick.pointerId === p.id) this.release(stick);
  }

  private release(stick: VirtualStick): void {
    stick.pointerId = null;
    stick.state.x = stick.state.y = 0;
    stick.state.active = false;
    stick.base.setPosition(stick.home.x, stick.home.y);
    stick.knob
      .setPosition(stick.home.x, stick.home.y)
      .setFillStyle(ZONE_COLOR.cancel)
      .setAlpha(IDLE_ALPHA);
    if (stick === this.sticks.right) this.mgRing.setPosition(stick.home.x, stick.home.y);
  }

  /** ALT stays lit and the MG ring shows while MG mode is on. */
  private refreshMgMode(): void {
    this.altButton.setFillStyle(ALT_COLOR, touchState.mgOn ? 0.7 : IDLE_ALPHA);
    this.mgRing.setVisible(touchState.mgOn);
  }
}

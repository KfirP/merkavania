import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../logic/scale';
import { touchState, type StickState } from '../input/touchState';
import { SceneKey } from './keys';

const STICK_RADIUS = 28;
const KNOB_RADIUS = 11;
const ALT_BUTTON = { x: GAME_WIDTH - 30, y: GAME_HEIGHT - 110, r: 16 };
const IDLE_ALPHA = 0.25;

interface VirtualStick {
  state: StickState;
  pointerId: number | null;
  base: Phaser.GameObjects.Arc;
  knob: Phaser.GameObjects.Arc;
  home: { x: number; y: number };
}

/**
 * Dual floating virtual sticks: each appears where the thumb lands in its half of the screen.
 * Left drives the hull, right aims and fires past 60%. Writes `touchState` for TouchAdapter.
 * Always running but hidden until the first real touch: many desktop browsers report touch
 * support, and a touchscreen laptop may never be touched.
 */
export class TouchControlsScene extends Phaser.Scene {
  private sticks!: { left: VirtualStick; right: VirtualStick };
  private altPointerId: number | null = null;
  private altButton!: Phaser.GameObjects.Arc;

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
      .circle(ALT_BUTTON.x, ALT_BUTTON.y, ALT_BUTTON.r, 0xffb030, IDLE_ALPHA)
      .setStrokeStyle(1, 0xffffff, 0.6);
    this.cameras.main.setVisible(false);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const s of Object.values(this.sticks)) this.release(s);
      touchState.altFire = false;
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
      this.altPointerId = p.id;
      touchState.altFire = true;
      this.altButton.setFillStyle(0xffb030, 0.6);
      return;
    }
    const stick = p.x < GAME_WIDTH / 2 ? this.sticks.left : this.sticks.right;
    if (stick.pointerId !== null) return;
    stick.pointerId = p.id;
    stick.state.active = true;
    stick.base.setPosition(p.x, p.y);
    stick.knob.setPosition(p.x, p.y).setAlpha(0.5);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!p.wasTouch) return;
    touchState.lastTouchAt = performance.now();
    for (const stick of Object.values(this.sticks)) {
      if (stick.pointerId !== p.id) continue;
      const dx = p.x - stick.base.x;
      const dy = p.y - stick.base.y;
      const dist = Math.hypot(dx, dy);
      const k = dist > STICK_RADIUS ? STICK_RADIUS / dist : 1;
      stick.knob.setPosition(stick.base.x + dx * k, stick.base.y + dy * k);
      stick.state.x = (dx * k) / STICK_RADIUS;
      stick.state.y = (dy * k) / STICK_RADIUS;
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (!p.wasTouch) return;
    touchState.lastTouchAt = performance.now();
    if (this.altPointerId === p.id) {
      this.altPointerId = null;
      touchState.altFire = false;
      this.altButton.setFillStyle(0xffb030, IDLE_ALPHA);
    }
    for (const stick of Object.values(this.sticks))
      if (stick.pointerId === p.id) this.release(stick);
  }

  private release(stick: VirtualStick): void {
    stick.pointerId = null;
    stick.state.x = stick.state.y = 0;
    stick.state.active = false;
    stick.base.setPosition(stick.home.x, stick.home.y);
    stick.knob.setPosition(stick.home.x, stick.home.y).setAlpha(IDLE_ALPHA);
  }
}

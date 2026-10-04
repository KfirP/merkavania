import Phaser from 'phaser';
import { stickMagnitude } from '../../logic/input/stick';
import { hitTouchButton, TOUCH_BUTTONS, type TouchButtonId } from '../../logic/input/touchButtons';
import { TOUCH_MG_THRESHOLD, touchAimZone, type TouchAimZone } from '../../logic/input/touchAim';
import { dragToStick } from '../../logic/input/virtualStick';
import { GAME_HEIGHT, GAME_WIDTH } from '../../logic/scale';
import { events, type GameEvents } from '../events';
import { touchState, type StickState, type TouchTap } from '../input/touchState';
import { textStyle } from '../ui/text';
import { SceneKey } from './keys';

const STICK_RADIUS = 28;
const KNOB_RADIUS = 11;
const ALT_BUTTON = TOUCH_BUTTONS.alt;
const MORTAR_BUTTON = TOUCH_BUTTONS.mortar;
const MORTAR_COLOR = 0xc2b280;
const HATCH_COLOR = 0x85854a;
const SWAP_COLOR = 0x8fa3b8;
const REPAIR_COLOR = 0x6fbf4a;
const MENU_COLOR = 0xffffff;
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
 * first cancels. The ALT button toggles MG mode, which switches the right stick to the coax: its
 * outer ring (shown only in MG mode) fires the MG, and lifting never fires the cannon. Once the
 * tank has the mortar, its button appears: drag from it to a spot and lift to lob a shell there
 * (back onto the button cancels). Once it has the scout, a tap on the hatch button deploys or
 * recalls it. Swap cycles the secondary (with more than one), repair spends a repair kit charge
 * (while there is one), and map and pause sit at the top centre. Writes `touchState` for
 * TouchAdapter; rules in touchAim.ts, touchLob.ts and touchButtons.ts.
 * With the `auto` touch setting it runs but stays hidden until the first real touch: many desktop
 * browsers report touch support, and a touchscreen laptop may never be touched. `on` shows it
 * straight away.
 */
export class TouchControlsScene extends Phaser.Scene {
  private sticks!: { left: VirtualStick; right: VirtualStick };
  private altButton!: Phaser.GameObjects.Arc;
  private mgRing!: Phaser.GameObjects.Arc;
  private mortarButton!: Phaser.GameObjects.Arc;
  private hatchButton!: Phaser.GameObjects.Arc;
  /** One-press buttons, with their icons. */
  private taps!: Record<TouchTap, Phaser.GameObjects.Container>;
  private lobLine!: Phaser.GameObjects.Graphics;
  private lobPointer: number | null = null;

  constructor() {
    super(SceneKey.TouchControls);
  }

  create(data: { visible?: boolean } = {}): void {
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
    this.mortarButton = this.add
      .circle(MORTAR_BUTTON.x, MORTAR_BUTTON.y, MORTAR_BUTTON.r, MORTAR_COLOR, IDLE_ALPHA)
      .setStrokeStyle(1, 0xffffff, 0.6);
    this.lobLine = this.add.graphics();
    const hatch = TOUCH_BUTTONS.hatch;
    this.hatchButton = this.add
      .circle(hatch.x, hatch.y, hatch.r, HATCH_COLOR, IDLE_ALPHA)
      .setStrokeStyle(1, 0xffffff, 0.6);
    this.taps = {
      hatch: this.add.container(0, 0, [this.hatchButton]),
      swap: this.tapButton('swap', SWAP_COLOR, '<>'),
      repair: this.tapButton('repair', REPAIR_COLOR, '+'),
      map: this.tapButton('map', MENU_COLOR, 'M'),
      pause: this.tapButton('pause', MENU_COLOR, 'II'),
    };
    this.onLoadout(events.latest('loadout:changed'));
    this.onAbilities(events.latest('abilities:changed'));
    this.onRepair(events.latest('repair:changed'));
    events.on('loadout:changed', this.onLoadout, this);
    events.on('abilities:changed', this.onAbilities, this);
    events.on('repair:changed', this.onRepair, this);
    this.cameras.main.setVisible(data.visible ?? false);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const s of Object.values(this.sticks)) this.release(s);
      touchState.mgOn = false;
      this.releaseLob();
      events.off('loadout:changed', this.onLoadout, this);
      events.off('abilities:changed', this.onAbilities, this);
      events.off('repair:changed', this.onRepair, this);
      for (const k of Object.keys(touchState.taps) as TouchTap[]) touchState.taps[k] = false;
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
    const button = hitTouchButton(p.x, p.y, (id) => this.isShown(id));
    if (button === 'alt') {
      touchState.mgOn = !touchState.mgOn;
      this.refreshMgMode();
      return;
    }
    if (button && button !== 'mortar') {
      touchState.taps[button] = true;
      const circle = this.taps[button].list[0] as Phaser.GameObjects.Arc;
      circle.setFillStyle(circle.fillColor, 0.7);
      this.time.delayedCall(120, () => circle.setFillStyle(circle.fillColor, IDLE_ALPHA));
      return;
    }
    if (button === 'mortar' && this.lobPointer === null) {
      this.lobPointer = p.id;
      Object.assign(touchState.lob, { active: true, overButton: true, x: p.x, y: p.y });
      this.mortarButton.setAlpha(0.7);
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
    if (p.id === this.lobPointer) this.dragLob(p);
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
    if (p.id === this.lobPointer) {
      this.dragLob(p);
      this.releaseLob();
    }
    for (const stick of Object.values(this.sticks))
      if (stick.pointerId === p.id) this.release(stick);
  }

  private overMortar(p: { x: number; y: number }): boolean {
    const d = Phaser.Math.Distance.Between(p.x, p.y, MORTAR_BUTTON.x, MORTAR_BUTTON.y);
    return d <= MORTAR_BUTTON.r + 4;
  }

  /** Follows the finger with a line and a target ring; grey while it's back on the button. */
  private dragLob(p: Phaser.Input.Pointer): void {
    const over = this.overMortar(p);
    Object.assign(touchState.lob, { overButton: over, x: p.x, y: p.y });
    const color = over ? ZONE_COLOR.cancel : ZONE_COLOR.armed;
    this.lobLine
      .clear()
      .lineStyle(1, color, 0.6)
      .lineBetween(MORTAR_BUTTON.x, MORTAR_BUTTON.y, p.x, p.y)
      .strokeCircle(p.x, p.y, 6);
  }

  /** The finger lifted: TouchAdapter fires (or not) from the last spot in `touchState.lob`. */
  private releaseLob(): void {
    this.lobPointer = null;
    touchState.lob.active = false;
    this.lobLine.clear();
    this.mortarButton.setAlpha(IDLE_ALPHA);
  }

  private onLoadout(loadout: GameEvents['loadout:changed'] | undefined): void {
    this.mortarButton.setVisible(loadout?.unlocked.includes('mortar') ?? false);
    this.taps.swap.setVisible((loadout?.unlocked.length ?? 0) > 1);
  }

  private onAbilities(a: GameEvents['abilities:changed'] | undefined): void {
    this.taps.hatch.setVisible(a?.abilities.includes('hatch_scout') ?? false);
    this.hatchButton.setVisible(this.taps.hatch.visible);
  }

  private onRepair(r: GameEvents['repair:changed'] | undefined): void {
    this.taps.repair.setVisible((r?.charges ?? 0) > 0);
  }

  /** Whether button `id` is on screen (and so can be pressed). */
  isShown(id: TouchButtonId): boolean {
    if (id === 'alt') return true;
    if (id === 'mortar') return this.mortarButton.visible;
    return this.taps[id].visible;
  }

  /** A round one-press button with a short label for its icon. */
  private tapButton(id: TouchTap, color: number, label: string): Phaser.GameObjects.Container {
    const b = TOUCH_BUTTONS[id];
    return this.add.container(b.x, b.y, [
      this.add.circle(0, 0, b.r, color, IDLE_ALPHA).setStrokeStyle(1, 0xffffff, 0.6),
      this.add
        .text(0, 0, label, textStyle(1, { rtl: false }))
        .setOrigin(0.5)
        .setAlpha(0.8),
    ]);
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

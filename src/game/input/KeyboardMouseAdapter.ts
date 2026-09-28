import Phaser from 'phaser';
import { RisingEdge } from '../../logic/input/edge';
import { keyAxis, mouseButtons } from '../../logic/input/mapping';
import { angleTo } from '../../logic/input/stick';
import type { TankCommand } from '../../logic/input/TankCommand';
import type { InputAdapter, InputContext } from './InputAdapter';
import { recentlyTouched } from './touchState';

const K = Phaser.Input.Keyboard.KeyCodes;

/**
 * WASD/arrows drive the hull and the mouse aims (world position). Right click fires the main gun,
 * left click is alt fire. See GAME_DESIGN.md controls.
 */
export class KeyboardMouseAdapter implements InputAdapter {
  private readonly keys;
  private readonly edges = {
    cycleNext: new RisingEdge(),
    cyclePrev: new RisingEdge(),
    hatch: new RisingEdge(),
    interact: new RisingEdge(),
    map: new RisingEdge(),
    pause: new RisingEdge(),
  };
  private wheel = 0;
  private lastPointer = { x: NaN, y: NaN };
  /** Mouse buttons count only after one release, so the click that left the title doesn't fire. */
  private buttonsArmed = false;
  private readonly onWheel = (_p: unknown, _o: unknown, _dx: number, dy: number) => {
    this.wheel += dy;
  };

  constructor(private readonly scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('Keyboard input is disabled');
    this.keys = kb.addKeys({
      w: K.W,
      a: K.A,
      s: K.S,
      d: K.D,
      up: K.UP,
      left: K.LEFT,
      down: K.DOWN,
      right: K.RIGHT,
      q: K.Q,
      e: K.E,
      f: K.F,
      space: K.SPACE,
      m: K.M,
      tab: K.TAB,
      esc: K.ESC,
    }) as Record<string, Phaser.Input.Keyboard.Key>;
    scene.input.mouse?.disableContextMenu();
    scene.input.on('wheel', this.onWheel);
  }

  poll(cmd: TankCommand, origin: InputContext): boolean {
    const k = this.keys;
    const down = (...names: string[]) => names.some((n) => k[n]?.isDown);

    cmd.throttle = keyAxis(down('s', 'down'), down('w', 'up'));
    cmd.turn = keyAxis(down('a', 'left'), down('d', 'right'));

    const wheel = Math.sign(this.wheel);
    this.wheel = 0;
    cmd.cycleNext = this.edges.cycleNext.update(down('e')) || wheel > 0;
    cmd.cyclePrev = this.edges.cyclePrev.update(down('q')) || wheel < 0;
    cmd.hatch = this.edges.hatch.update(down('f'));
    cmd.interact = this.edges.interact.update(down('space'));
    cmd.map = this.edges.map.update(down('m', 'tab'));
    cmd.pause = this.edges.pause.update(down('esc'));

    const anyKey = Object.values(k).some((key) => key.isDown) || wheel !== 0;

    // Mouse; browsers emulate mouse events after touches, so ignore it right after a touch.
    const mouse = this.scene.input.mousePointer;
    if (!mouse || recentlyTouched()) {
      cmd.aimAngle = null;
      cmd.fire = cmd.altFire = false;
      return anyKey;
    }
    const cam = this.scene.cameras.main;
    const world = mouse.positionToCamera(cam) as Phaser.Math.Vector2;
    cmd.aimAngle = angleTo(origin.x, origin.y, world.x, world.y);
    const buttons = mouseButtons(
      mouse.leftButtonDown(),
      mouse.rightButtonDown(),
      this.buttonsArmed,
    );
    this.buttonsArmed = buttons.armed;
    cmd.fire = buttons.fire;
    cmd.altFire = buttons.altFire;

    const moved = mouse.x !== this.lastPointer.x || mouse.y !== this.lastPointer.y;
    this.lastPointer = { x: mouse.x, y: mouse.y };
    return anyKey || moved || cmd.fire || cmd.altFire;
  }

  destroy(): void {
    this.scene.input.off('wheel', this.onWheel);
  }
}

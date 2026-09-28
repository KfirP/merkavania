import type Phaser from 'phaser';
import { RisingEdge } from '../../logic/input/edge';
import { applyRadialDeadzone, stickAngle } from '../../logic/input/stick';
import type { TankCommand } from '../../logic/input/TankCommand';
import type { InputAdapter } from './InputAdapter';

const STICK_DEADZONE = 0.2;
const AIM_DEADZONE = 0.35;
const TRIGGER_THRESHOLD = 0.4;

/** Standard-mapping button indices (W3C Gamepad "standard" layout). */
const B = { a: 0, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, select: 8, start: 9 } as const;

/** Left stick drives, right stick aims, RT/LT fire. See GAME_DESIGN.md controls. */
export class GamepadAdapter implements InputAdapter {
  private readonly edges = {
    cycleNext: new RisingEdge(),
    cyclePrev: new RisingEdge(),
    hatch: new RisingEdge(),
    interact: new RisingEdge(),
    map: new RisingEdge(),
    pause: new RisingEdge(),
  };

  constructor(private readonly scene: Phaser.Scene) {}

  poll(cmd: TankCommand): boolean {
    const pad = this.scene.input.gamepad?.gamepads.find((p) => p?.connected);
    if (!pad) return false;

    const value = (i: number) => pad.buttons[i]?.value ?? 0;
    const pressed = (i: number) => value(i) > TRIGGER_THRESHOLD;
    const axis = (i: number) => pad.axes[i]?.getValue() ?? 0;

    const left = applyRadialDeadzone(axis(0), axis(1), STICK_DEADZONE);
    cmd.throttle = -left.y;
    cmd.turn = left.x;

    const rx = axis(2);
    const ry = axis(3);
    const right = applyRadialDeadzone(rx, ry, AIM_DEADZONE);
    const aiming = right.x !== 0 || right.y !== 0;
    cmd.aimAngle = aiming ? stickAngle(rx, ry) : null;

    cmd.fire = pressed(B.rt);
    cmd.altFire = pressed(B.lt);
    cmd.cycleNext = this.edges.cycleNext.update(pressed(B.rb));
    cmd.cyclePrev = this.edges.cyclePrev.update(pressed(B.lb));
    cmd.hatch = this.edges.hatch.update(pressed(B.y));
    cmd.interact = this.edges.interact.update(pressed(B.a));
    cmd.map = this.edges.map.update(pressed(B.select));
    cmd.pause = this.edges.pause.update(pressed(B.start));

    const anyButton = pad.buttons.some((b) => b.value > TRIGGER_THRESHOLD);
    return anyButton || left.x !== 0 || left.y !== 0 || aiming;
  }

  destroy(): void {}
}

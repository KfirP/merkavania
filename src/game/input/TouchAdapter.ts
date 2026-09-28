import { applyRadialDeadzone, stickAngle, stickMagnitude } from '../../logic/input/stick';
import type { TankCommand } from '../../logic/input/TankCommand';
import type { InputAdapter } from './InputAdapter';
import { touchState } from './touchState';

const STICK_DEADZONE = 0.15;
const AIM_DEADZONE = 0.25;
/** The right stick fires the main gun while pushed past this (ARCHITECTURE.md). */
const FIRE_THRESHOLD = 0.6;

/** Reads the virtual sticks drawn by TouchControlsScene. */
export class TouchAdapter implements InputAdapter {
  poll(cmd: TankCommand): boolean {
    const { left, right } = touchState;
    const move = applyRadialDeadzone(left.x, left.y, STICK_DEADZONE);
    cmd.throttle = -move.y;
    cmd.turn = move.x;

    const mag = stickMagnitude(right.x, right.y);
    cmd.aimAngle = right.active && mag > AIM_DEADZONE ? stickAngle(right.x, right.y) : null;
    cmd.fire = right.active && mag > FIRE_THRESHOLD;
    cmd.altFire = touchState.altFire;
    return left.active || right.active || touchState.altFire;
  }

  destroy(): void {}
}

import { applyRadialDeadzone, stickAngle } from './stick';

/** Device → TankCommand mapping rules, kept pure so they're unit-tested (adapters just read devices). */

export const PAD_STICK_DEADZONE = 0.2;
export const PAD_AIM_DEADZONE = 0.35;
export const TOUCH_STICK_DEADZONE = 0.15;

export interface AnalogCommand {
  throttle: number;
  turn: number;
  aimAngle: number | null;
}

export interface StickInput {
  x: number;
  y: number;
  active: boolean;
}

/** A negative/positive key pair as an axis; both held cancel out. */
export function keyAxis(negative: boolean, positive: boolean): number {
  return (positive ? 1 : 0) - (negative ? 1 : 0);
}

/**
 * Right click fires the main gun, left click is alt fire (GAME_DESIGN.md controls). Buttons are
 * ignored until both have been released once, so the click that left the title doesn't fire.
 */
export function mouseButtons(
  left: boolean,
  right: boolean,
  armed: boolean,
): { fire: boolean; altFire: boolean; armed: boolean } {
  const nowArmed = armed || (!left && !right);
  return { fire: nowArmed && right, altFire: nowArmed && left, armed: nowArmed };
}

/** Left stick drives (up = forward), right stick aims; a centred right stick keeps the aim. */
export function padAnalog(lx: number, ly: number, rx: number, ry: number): AnalogCommand {
  const left = applyRadialDeadzone(lx, ly, PAD_STICK_DEADZONE);
  const right = applyRadialDeadzone(rx, ry, PAD_AIM_DEADZONE);
  const aiming = right.x !== 0 || right.y !== 0;
  return {
    throttle: left.y === 0 ? 0 : -left.y,
    turn: left.x,
    aimAngle: aiming ? stickAngle(rx, ry) : null,
  };
}

/** Left virtual stick drives (up = forward). The right stick is handled by `touchAim.ts`. */
export function touchMove(left: StickInput): { throttle: number; turn: number } {
  const move = applyRadialDeadzone(left.x, left.y, TOUCH_STICK_DEADZONE);
  return { throttle: move.y === 0 ? 0 : -move.y, turn: move.x };
}

/**
 * Gamepad mortar range: right-stick tilt past the aim deadzone maps linearly onto min..max; a
 * centred stick gives null (keep the last range).
 */
export function padLobDistance(magnitude: number, min: number, max: number): number | null {
  if (magnitude <= PAD_AIM_DEADZONE) return null;
  const t = Math.min(1, (magnitude - PAD_AIM_DEADZONE) / (1 - PAD_AIM_DEADZONE));
  return min + (max - min) * t;
}

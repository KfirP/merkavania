import type { StickInput } from './mapping';
import { stickAngle, stickMagnitude, wrapAngle } from './stick';

/**
 * Right virtual stick (docs/GAME_DESIGN.md controls):
 * - Drag past TOUCH_AIM_DEADZONE to aim; the stick is then "armed" and lifting fires the cannon.
 *   Dragging back inside the deadzone before lifting cancels. A tap never fires.
 * - The aim is sticky: after lifting, the turret keeps turning to the last aimed angle.
 * - The released shot waits until the turret has lined up, so a quick flick doesn't fire
 *   mid-swing. It clears when the gun fires, and is dropped if the gun can't fire within
 *   FIRE_WINDOW of lining up (e.g. while the quick rounds refill).
 * - With MG mode on (ALT toggle), dragging past TOUCH_MG_THRESHOLD fires the coax while held.
 */
export const TOUCH_AIM_DEADZONE = 0.3;
export const TOUCH_MG_THRESHOLD = 0.7;
/** Radians between turret and target that count as lined up. */
export const ALIGN_TOLERANCE = 0.05;
/** Seconds a lined-up queued shot waits for the gun before it's dropped. */
export const FIRE_WINDOW = 0.5;

export interface TouchAimState {
  /** Last aimed world angle; null until the first drag. */
  target: number | null;
  wasActive: boolean;
  /** A release now would fire. */
  armed: boolean;
  /** A released shot waiting for the turret; `alignedFor` counts time since it lined up. */
  pending: { angle: number; alignedFor: number } | null;
}

export interface TouchAimInput {
  right: StickInput;
  mgOn: boolean;
  turretAngle: number;
  /** The main gun fired since the last step. */
  gunFired: boolean;
  dt: number;
}

export interface TouchAimOutput {
  state: TouchAimState;
  aimAngle: number | null;
  fire: boolean;
  altFire: boolean;
}

export function initialTouchAim(): TouchAimState {
  return { target: null, wasActive: false, armed: false, pending: null };
}

/** Where the knob sits: inside the cancel zone, armed, or firing the MG (for UI feedback). */
export type TouchAimZone = 'cancel' | 'armed' | 'mg';

export function touchAimZone(magnitude: number, mgOn: boolean): TouchAimZone {
  if (magnitude <= TOUCH_AIM_DEADZONE) return 'cancel';
  return mgOn && magnitude > TOUCH_MG_THRESHOLD ? 'mg' : 'armed';
}

export function stepTouchAim(state: TouchAimState, input: TouchAimInput): TouchAimOutput {
  const { right } = input;
  const mag = stickMagnitude(right.x, right.y);
  let { target, pending } = state;
  let armed: boolean;

  if (right.active) {
    armed = mag > TOUCH_AIM_DEADZONE;
    if (armed) {
      target = stickAngle(right.x, right.y);
      pending = null; // re-aiming cancels a shot still waiting for the turret
    }
  } else {
    if (state.wasActive && state.armed && target !== null)
      pending = { angle: target, alignedFor: 0 };
    armed = false;
  }

  let fire = false;
  if (pending) {
    const aligned = Math.abs(wrapAngle(input.turretAngle - pending.angle)) <= ALIGN_TOLERANCE;
    if (input.gunFired || pending.alignedFor > FIRE_WINDOW) pending = null;
    else if (aligned) {
      fire = true;
      pending = { ...pending, alignedFor: pending.alignedFor + input.dt };
    }
  }

  return {
    state: { target, wasActive: right.active, armed, pending },
    aimAngle: target,
    fire,
    altFire: right.active && touchAimZone(mag, input.mgOn) === 'mg',
  };
}

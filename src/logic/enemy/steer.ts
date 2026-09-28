import { clamp, wrapAngle, type Vec2 } from '../input/stick';

/** How hard the hull turns per radian of heading error (full lock past ~20°). */
const TURN_GAIN = 3;

/**
 * Throttle and turn (TankCommand-style, -1..1) for a tracked or wheeled vehicle heading from
 * `from` to `to`: full speed when facing it, slowing as the angle opens, and pivoting in place
 * when it's behind. Stops within `arrive` px.
 */
export function steerToward(
  heading: number,
  from: Vec2,
  to: Vec2,
  arrive: number,
): { throttle: number; turn: number } {
  if (Math.hypot(to.x - from.x, to.y - from.y) <= arrive) return { throttle: 0, turn: 0 };
  const diff = wrapAngle(Math.atan2(to.y - from.y, to.x - from.x) - heading);
  const turn = clamp(diff * TURN_GAIN, -1, 1) || 0;
  const throttle = Math.abs(diff) > Math.PI / 2 ? 0 : Math.cos(diff);
  return { throttle, turn };
}

/** `angle`, limited to within `arc` radians either side of `facing` (static guns' traverse). */
export function clampToArc(angle: number, facing: number, arc: number): number {
  const diff = wrapAngle(angle - facing);
  return Math.abs(diff) <= arc ? wrapAngle(angle) : wrapAngle(facing + Math.sign(diff) * arc);
}

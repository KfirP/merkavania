import { clamp, wrapAngle } from '../input/stick';

/** Per-tier hull handling. Speeds in px/s, rates in px/s² and rad/s. */
export interface HullStats {
  maxSpeed: number;
  reverseSpeed: number;
  /** Gaining speed in the throttle direction. */
  accel: number;
  /** Slowing down while throttling against the current motion. */
  brake: number;
  /** Coasting to a stop with no throttle. */
  drag: number;
  turnRate: number;
}

export interface HullState {
  /** Radians, 0 = east. */
  heading: number;
  /** Signed px/s along the heading; negative is reversing. */
  speed: number;
}

/** Hull stats on terrain with speed multiplier `mul`: only the top speeds change. */
export function withSpeedMul(stats: HullStats, mul: number): HullStats {
  if (mul === 1) return stats;
  return { ...stats, maxSpeed: stats.maxSpeed * mul, reverseSpeed: stats.reverseSpeed * mul };
}

/** Advances hull heading and speed by one step. Tracks can pivot in place, so turning never needs speed. */
export function stepHull(
  state: HullState,
  throttle: number,
  turn: number,
  stats: HullStats,
  dt: number,
): HullState {
  const t = clamp(throttle, -1, 1);
  const target = t >= 0 ? t * stats.maxSpeed : t * stats.reverseSpeed;
  const delta = target - state.speed;

  let rate: number;
  if (t === 0) rate = stats.drag;
  else if (Math.sign(delta) === Math.sign(state.speed) || state.speed === 0) rate = stats.accel;
  // Slowing down: braking when the throttle opposes the motion, coasting when it's just eased off.
  else if (Math.sign(t) !== Math.sign(state.speed)) rate = stats.brake;
  else rate = stats.drag;

  const step = rate * dt;
  const speed = Math.abs(delta) <= step ? target : state.speed + Math.sign(delta) * step;
  const heading = wrapAngle(state.heading + clamp(turn, -1, 1) * stats.turnRate * dt);
  return { heading, speed };
}

/**
 * Hull speed after a wall collision. Arcade zeroes the blocked velocity axis, so projecting the
 * velocity it kept onto the heading gives what the tank actually achieved: ramming a wall kills
 * momentum instead of storing it, and sliding along one bleeds speed. Never adds speed.
 */
export function speedAfterImpact(speed: number, heading: number, vx: number, vy: number): number {
  const achieved = vx * Math.cos(heading) + vy * Math.sin(heading);
  const result = Math.abs(achieved) < Math.abs(speed) ? achieved : speed;
  return Math.abs(result) < 1e-9 ? 0 : result;
}

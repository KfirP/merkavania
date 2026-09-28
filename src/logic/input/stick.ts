/** Device-independent analog stick and aim helpers. */

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Radial deadzone: inputs inside `deadzone` become zero, and the rest is rescaled so the
 * magnitude still runs smoothly from 0 at the deadzone edge to 1 at full deflection.
 */
export function applyRadialDeadzone(x: number, y: number, deadzone: number): Vec2 {
  const mag = Math.hypot(x, y);
  if (mag <= deadzone || mag === 0) return { x: 0, y: 0 };
  const scaled = Math.min(1, (mag - deadzone) / (1 - deadzone));
  return { x: (x / mag) * scaled, y: (y / mag) * scaled };
}

export function stickMagnitude(x: number, y: number): number {
  return Math.min(1, Math.hypot(x, y));
}

/** Screen-space stick angle in radians (y points down, so 0 = east, π/2 = south). */
export function stickAngle(x: number, y: number): number {
  return Math.atan2(y, x);
}

/** Angle from point a to point b in world space. */
export function angleTo(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(by - ay, bx - ax);
}

/** Wraps an angle to (-π, π]. */
export function wrapAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  let a = angle % twoPi;
  if (a <= -Math.PI) a += twoPi;
  else if (a > Math.PI) a -= twoPi;
  return a;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

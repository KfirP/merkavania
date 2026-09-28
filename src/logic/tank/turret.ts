import { wrapAngle } from '../input/stick';

/** Rotates `angle` toward `target` along the shorter arc at `traverseRate` rad/s, without overshooting. */
export function stepTurret(
  angle: number,
  target: number,
  traverseRate: number,
  dt: number,
): number {
  const diff = wrapAngle(target - angle);
  const step = traverseRate * dt;
  if (Math.abs(diff) <= step) return wrapAngle(target);
  return wrapAngle(angle + Math.sign(diff) * step);
}

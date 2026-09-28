import type { Vec2 } from '../input/stick';
import { stepTurret } from '../tank/turret';

/**
 * A guided missile's new heading: it turns toward the target no faster than `turnRate` rad/s, so
 * sharp dodges and cover beat it. Without a target it flies straight.
 */
export function steerMissile(
  angle: number,
  pos: Vec2,
  target: Vec2 | null,
  turnRate: number,
  dt: number,
): number {
  if (!target) return angle;
  return stepTurret(angle, Math.atan2(target.y - pos.y, target.x - pos.x), turnRate, dt);
}

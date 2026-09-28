import type { Vec2 } from '../input/stick';
import { TILE } from './chunks';
import { projectileBlocked, wallBlocksProjectile, type CellLookup } from './traversal';

/** Distance between samples along the line, px. */
const STEP = TILE / 4;

/**
 * Whether a shot fired on `level` from `from` could reach `to`: it follows the same rules as
 * direct fire (walls on its level or below stop it, rising ground stops it, lower ground doesn't),
 * so enemies see exactly what they can shoot. Unloaded cells block.
 */
export function hasLineOfSight(from: Vec2, to: Vec2, level: number, cellAt: CellLookup): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / STEP));
  for (let i = 1; i < steps; i++) {
    const cell = cellAt(
      Math.floor((from.x + (dx * i) / steps) / TILE),
      Math.floor((from.y + (dy * i) / steps) / TILE),
    );
    if (!cell) return false;
    if (cell.solid && wallBlocksProjectile(cell.level, level)) return false;
    if (projectileBlocked(level, cell)) return false;
  }
  return true;
}

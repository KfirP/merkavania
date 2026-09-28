import type { AbilityId } from '../../data/abilities';
import { TILE } from '../../logic/world/chunks';
import type { WorldGrid } from '../../logic/world/grid';
import { constrainMove, levelAt, speedMulAt, type CellLookup } from '../../logic/world/traversal';
import type { Pawn } from '../entities/Pawn';

/**
 * Applies the grid's movement rules to the active pawn (docs/ARCHITECTURE.md, Elevation).
 *
 * Works on the physics body, not the sprite: Arcade steps bodies before the scene's update and
 * copies the result to the sprite only in postUpdate, so during update the sprite is a step behind.
 */
export class ElevationSystem {
  readonly cellAt: CellLookup;

  constructor(
    grid: WorldGrid,
    /** Abilities the pawn has; GameState supplies these from M4. */
    private readonly abilities: () => readonly AbilityId[] = () => [],
  ) {
    this.cellAt = (tx, ty) => grid.cellAt(tx, ty);
  }

  /** Before the pawn moves: its level and the speed multiplier of the terrain under it. */
  prepare(pawn: Pawn): void {
    const { x, y } = pawn.pos;
    pawn.level = levelAt(x, y, this.cellAt);
    pawn.speedMul = speedMulAt(this.cellAt(Math.floor(x / TILE), Math.floor(y / TILE)));
  }

  /**
   * After the pawn set its velocity: stops it at any cliff or gate the next step would cross. A
   * blocked axis moves the body to the boundary now and zeroes that velocity; a clamped velocity
   * alone would overshoot, since Arcade integrates with the real frame time, which can exceed `dt`.
   */
  constrain(pawn: Pawn, dt: number): void {
    const body = pawn.body;
    const v = body.velocity;
    const m = constrainMove(body.center, body.radius, v.x, v.y, dt, this.cellAt, {
      pawn: pawn.kind,
      abilities: this.abilities(),
    });
    if (!m.blockedX && !m.blockedY) return;
    if (m.blockedX) body.position.x += m.vx * dt;
    if (m.blockedY) body.position.y += m.vy * dt;
    body.updateCenter();
    const vx = m.blockedX ? 0 : m.vx;
    const vy = m.blockedY ? 0 : m.vy;
    v.set(vx, vy);
    pawn.onBlocked?.(vx, vy);
  }
}

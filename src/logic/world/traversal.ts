import type { AbilityId } from '../../data/abilities';
import { isTerrainId, terrains, type PawnKind } from '../../data/terrain';
import { TILE } from './chunks';
import type { Cell, Dir } from './grid';

/**
 * Movement rules over the cell grid (docs/ARCHITECTURE.md, Elevation). A ramp's `level` is its
 * low end; travelling in its `ramp` direction climbs exactly one level.
 */

export interface MoveContext {
  pawn: PawnKind;
  abilities: readonly AbilityId[];
}

export type CellLookup = (tx: number, ty: number) => Cell | null;

const OPPOSITE: Record<Dir, Dir> = { n: 's', s: 'n', e: 'w', w: 'e' };

/** Whether the elevation change from `from` to `to` (moving `dir`) is walkable. */
function levelStep(from: Cell, to: Cell, dir: Dir, ctx: MoveContext): boolean {
  const rise = to.level - from.level;
  if (rise === 0) return true;
  if (Math.abs(rise) !== 1) return false;
  const [ramp, up] = rise > 0 ? [from, dir] : [to, OPPOSITE[dir]];
  if (ramp.ramp !== up) return false;
  return !ramp.steep || ctx.abilities.includes('suspension');
}

const ANY_TANK: MoveContext = { pawn: 'tank', abilities: ['suspension'] };

/** Whether two adjacent cells are joined in elevation: the same level, or a ramp of any kind. */
export function levelsConnect(from: Cell, to: Cell, dir: Dir): boolean {
  return levelStep(from, to, dir, ANY_TANK);
}

function terrainAllows(cell: Cell, ctx: MoveContext): boolean {
  if (cell.terrain === null || !isTerrainId(cell.terrain)) return true;
  const def = terrains[cell.terrain];
  if (def.pawns && !def.pawns.includes(ctx.pawn)) return false;
  const req = def.requires;
  return !req || req.without !== 'block' || ctx.abilities.includes(req.ability);
}

/** Whether a pawn may move from `from` into the adjacent cell `to` in direction `dir`. */
export function canEnter(from: Cell | null, to: Cell | null, dir: Dir, ctx: MoveContext): boolean {
  if (!to || to.solid || !terrainAllows(to, ctx)) return false;
  return !from || levelStep(from, to, dir, ctx);
}

export interface ConstrainedMove {
  vx: number;
  vy: number;
  blockedX: boolean;
  blockedY: boolean;
}

/**
 * How far (signed, px) the body's leading edge may move along one axis this step. Checks every
 * tile line the edge would enter, starting with the one it's in (so a body that overshot into a
 * forbidden cell gets pushed back out). On each line, every overlapped cell must be enterable from
 * the cell behind it, and neighbouring cells on the line must be level-connected, so the body
 * never straddles a cliff.
 */
function limitAxis(
  edge: number,
  delta: number,
  perpLo: number,
  perpHi: number,
  horizontal: boolean,
  cellAt: CellLookup,
  ctx: MoveContext,
): number | null {
  const step = Math.sign(delta);
  const dir: Dir = horizontal ? (step > 0 ? 'e' : 'w') : step > 0 ? 's' : 'n';
  const side: Dir = horizontal ? 's' : 'e';
  const tileOf = (p: number) => (step > 0 ? Math.ceil(p / TILE) - 1 : Math.floor(p / TILE));
  const start = tileOf(edge);
  const end = tileOf(edge + delta);
  const first = Math.floor(perpLo / TILE);
  const last = Math.ceil(perpHi / TILE) - 1;
  const at = (line: number, k: number) => (horizontal ? cellAt(line, k) : cellAt(k, line));

  for (let t = start; ; t += step) {
    for (let k = first; k <= last; k++) {
      const to = at(t, k);
      const beside = k > first ? at(t, k - 1) : null;
      const ok =
        canEnter(at(t - step, k), to, dir, ctx) &&
        (k === first || (beside !== null && levelStep(beside, to!, side, ctx)));
      if (!ok) return (step > 0 ? t * TILE : (t + 1) * TILE) - edge;
    }
    if (t === end) return null;
  }
}

/**
 * Clamps a circle body's velocity so this step can't carry it into a cell it may not enter
 * (cliffs, wrong-way ramps, solid tiles, gated terrain, unloaded chunks). Axis-separated, so the
 * body keeps sliding along the free axis.
 */
export function constrainMove(
  pos: { x: number; y: number },
  radius: number,
  vx: number,
  vy: number,
  dt: number,
  cellAt: CellLookup,
  ctx: MoveContext,
): ConstrainedMove {
  let blockedX = false;
  let blockedY = false;
  let x = pos.x;

  if (vx !== 0 && dt > 0) {
    const edge = x + Math.sign(vx) * radius;
    const limit = limitAxis(edge, vx * dt, pos.y - radius, pos.y + radius, true, cellAt, ctx);
    if (limit !== null) {
      blockedX = true;
      vx = limit / dt;
    }
    x += vx * dt;
  }
  if (vy !== 0 && dt > 0) {
    const edge = pos.y + Math.sign(vy) * radius;
    const limit = limitAxis(edge, vy * dt, x - radius, x + radius, false, cellAt, ctx);
    if (limit !== null) {
      blockedY = true;
      vy = limit / dt;
    }
  }
  return { vx, vy, blockedX, blockedY };
}

/** Elevation of the cell under a point; unloaded cells count as level 0. */
export function levelAt(x: number, y: number, cellAt: CellLookup): number {
  return cellAt(Math.floor(x / TILE), Math.floor(y / TILE))?.level ?? 0;
}

export function speedMulAt(cell: Cell | null): number {
  if (!cell?.terrain || !isTerrainId(cell.terrain)) return 1;
  return terrains[cell.terrain].speedMul;
}

/** Direct fire hits rising ground and passes over lower cells. */
export function projectileBlocked(projectileLevel: number, cell: Cell | null): boolean {
  return cell !== null && cell.level > projectileLevel;
}

export function wallBlocksProjectile(wallLevel: number, projectileLevel: number): boolean {
  return wallLevel >= projectileLevel;
}

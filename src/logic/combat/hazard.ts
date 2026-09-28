import type { AbilityId } from '../../data/abilities';
import { isTerrainId, terrains } from '../../data/terrain';
import type { Cell } from '../world/grid';

/** Damage a pawn takes this step from the terrain under it (`minefield`, `missile_zone`…). */
export function hazardDamage(
  cell: Cell | null,
  abilities: readonly AbilityId[],
  dt: number,
): number {
  if (!cell?.terrain || !isTerrainId(cell.terrain)) return 0;
  const def = terrains[cell.terrain];
  if (def.requires?.without !== 'hazard' || abilities.includes(def.requires.ability)) return 0;
  return (def.hazardDps ?? 0) * dt;
}

import type { AbilityId } from '../../data/abilities';
import { isTerrainId, terrains } from '../../data/terrain';

/**
 * A gated ground tile can name a `cleared` tile (same tileset) to show once the player has the
 * terrain's ability, e.g. rubble the dozer blade can push through. Returns that tile's local id,
 * or null to keep the tile as it is.
 */
export function clearedLook(
  props: Record<string, unknown>,
  abilities: readonly AbilityId[],
): number | null {
  const { cleared, terrain } = props;
  if (typeof cleared !== 'number' || typeof terrain !== 'string' || !isTerrainId(terrain))
    return null;
  const gate = terrains[terrain].requires;
  return gate && abilities.includes(gate.ability) ? cleared : null;
}

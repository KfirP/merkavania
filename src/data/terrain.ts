import type { AbilityId } from './abilities';

export type PawnKind = 'tank' | 'scout' | 'drone';

export interface TerrainDef {
  /** Multiplies the pawn's top speed while it's on this terrain. */
  speedMul: number;
  /**
   * Ability that makes the terrain passable. Without it the terrain either blocks movement or is
   * a `hazard`: enterable, but harmful (the damage arrives with M3 combat).
   */
  requires?: { ability: AbilityId; without: 'block' | 'hazard' };
  /** Only these pawns may enter; absent means any pawn. */
  pawns?: readonly PawnKind[];
}

export const terrainIds = [
  'sand',
  'rock',
  'road',
  'water_shallow',
  'water_deep',
  'mud',
  'rubble',
  'minefield',
  'crawlspace',
  'chasm',
  'missile_zone',
] as const;

export type TerrainId = (typeof terrainIds)[number];

/** Terrain ids and movement rules (LEVEL_DESIGN.md, Tile properties). */
export const terrains: Record<TerrainId, TerrainDef> = {
  sand: { speedMul: 1 },
  rock: { speedMul: 0.9 },
  road: { speedMul: 1.25 },
  water_shallow: { speedMul: 0.7 },
  water_deep: { speedMul: 0.5, requires: { ability: 'snorkel', without: 'block' } },
  mud: { speedMul: 0.6, requires: { ability: 'wide_tracks', without: 'block' } },
  rubble: { speedMul: 0.8, requires: { ability: 'dozer_blade', without: 'block' } },
  minefield: { speedMul: 0.8, requires: { ability: 'mine_plow', without: 'hazard' } },
  crawlspace: { speedMul: 1, pawns: ['scout'] },
  chasm: { speedMul: 1, pawns: ['drone'] },
  missile_zone: { speedMul: 1, requires: { ability: 'trophy', without: 'hazard' } },
};

export function isTerrainId(id: string): id is TerrainId {
  return Object.hasOwn(terrains, id);
}

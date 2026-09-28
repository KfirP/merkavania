import type { AssetKey } from './assetManifest';
import type { AmmoType } from './combat';

export const materialIds = ['sandbag', 'wood', 'concrete', 'armored'] as const;
export type MaterialId = (typeof materialIds)[number];

export interface MaterialDef {
  id: MaterialId;
  hp: number;
  /** Weakest ammo that damages it (GAME_DESIGN.md: concrete needs HEAT+, armored needs APFSDS). */
  minAmmo: AmmoType;
  sprite: AssetKey;
}

/** Destructible materials (LEVEL_DESIGN.md, `destructible` objects). */
export const materials: Record<MaterialId, MaterialDef> = {
  sandbag: { id: 'sandbag', hp: 30, minAmmo: 'standard', sprite: 'destructible_sandbag' },
  wood: { id: 'wood', hp: 15, minAmmo: 'standard', sprite: 'destructible_wood' },
  concrete: { id: 'concrete', hp: 80, minAmmo: 'heat', sprite: 'destructible_concrete' },
  armored: { id: 'armored', hp: 120, minAmmo: 'apfsds', sprite: 'destructible_armored' },
};

export function isMaterialId(id: unknown): id is MaterialId {
  return typeof id === 'string' && Object.hasOwn(materials, id);
}

import type { AbilityId } from './abilities';
import type { WeaponId } from './weapons';

/** Max HP each `armor_plate` adds. */
export const ARMOR_PLATE_HP = 20;
/** Extra rounds each `ammo_rack` adds to every limited secondary. */
export const AMMO_RACK_BONUS = 2;
/** Share of max HP one `repair_kit` charge restores (rounded up). Charges refill at depots. */
export const REPAIR_KIT_HEAL = 0.5;

/** Secondary weapons on alt fire, in cycle order (GAME_DESIGN.md, Controls). */
export const secondaryIds = ['coax_mg', 'mortar'] as const;

export type SecondaryId = (typeof secondaryIds)[number];

export interface SecondaryDef {
  weapon: WeaponId;
  /** Needed before it can be selected; absent means always available. */
  ability?: AbilityId;
  /** Base capacity of a limited secondary (refilled at depots); absent means unlimited. */
  ammo?: number;
}

export const secondaries: Record<SecondaryId, SecondaryDef> = {
  coax_mg: { weapon: 'coax_mg' },
  mortar: { weapon: 'mortar_60', ability: 'mortar', ammo: 6 },
};

export function isSecondaryId(id: unknown): id is SecondaryId {
  return secondaryIds.includes(id as SecondaryId);
}

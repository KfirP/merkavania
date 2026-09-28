/** Ability ids (GAME_DESIGN.md, Abilities & gates). Effects and pickups arrive in M4. */
export const abilityIds = [
  'mortar',
  'hatch_scout',
  'dozer_blade',
  'ammo_heat',
  'snorkel',
  'ammo_apfsds',
  'mine_plow',
  'smoke',
  'wide_tracks',
  'lahat',
  'hatch_drone',
  // Mk signatures
  'suspension',
  'trophy',
] as const;

export type AbilityId = (typeof abilityIds)[number];

/** Minor pickups (GAME_DESIGN.md): stat bumps, not gates. */
export const minorPickupIds = ['armor_plate', 'ammo_rack', 'repair_kit'] as const;

export type MinorPickupId = (typeof minorPickupIds)[number];

/** Damage tuning (GAME_DESIGN.md, Combat & damage). */

export const weaponClasses = ['small_arms', 'cannon', 'missile'] as const;
export type WeaponClass = (typeof weaponClasses)[number];

/** Ammo types in penetration order: each one breaks everything the ones before it do. */
export const ammoTypes = ['standard', 'heat', 'apfsds'] as const;
export type AmmoType = (typeof ammoTypes)[number];

export const armorIds = ['none', 'light', 'low', 'med', 'high', 'fortified'] as const;
export type ArmorId = (typeof armorIds)[number];

/** Share of a weapon's damage that gets through each armor, per weapon class. */
export const armorMultipliers: Record<ArmorId, Record<WeaponClass, number>> = {
  none: { small_arms: 1, cannon: 1, missile: 1 },
  light: { small_arms: 0.6, cannon: 1, missile: 1 },
  low: { small_arms: 0.25, cannon: 0.9, missile: 0.9 },
  med: { small_arms: 0.15, cannon: 0.75, missile: 0.8 },
  high: { small_arms: 0.05, cannon: 0.6, missile: 0.7 },
  fortified: { small_arms: 0.05, cannon: 0.8, missile: 0.9 },
};

/** At or below this multiplier a hit shows as a ricochet (sparks instead of a flash). */
export const RICOCHET_MULTIPLIER = 0.25;

/** Half-width of the rear arc, radians, around the direction the target faces. */
export const REAR_ARC = Math.PI / 4;
export const REAR_MULTIPLIER = 1.5;

/** Camera shake when the player is hit or an explosion goes off nearby. */
export const SHAKE = {
  hitMs: 120,
  /** Intensity per point of damage the player takes, capped at `maxIntensity`. */
  perDamage: 0.0006,
  maxIntensity: 0.012,
  /** Explosions within this distance of the camera centre shake it, px. */
  explosionRange: 160,
  explosionMs: 160,
  explosionIntensity: 0.006,
};

/** Hit flash duration, ms. */
export const HIT_FLASH_MS = 60;

/** Seconds from the player's death to the respawn. */
export const RESPAWN_DELAY = 1.5;

/** The tank runs over soldiers when moving at least this fast, px/s. */
export const CRUSH_SPEED = 15;

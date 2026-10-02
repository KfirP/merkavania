import type { AssetKey } from './assetManifest';
import type { AmmoType, WeaponClass } from './combat';

export type WeaponId =
  | 'gun_105'
  | 'coax_mg'
  | 'rifle'
  | 'mg_technical'
  | 'mg_bunker'
  | 'atgm'
  | 'gun_light_tank'
  | 'mortar_60';

export interface WeaponDef {
  id: WeaponId;
  projectile: AssetKey;
  /** px/s */
  speed: number;
  /** px travelled before the projectile expires */
  range: number;
  damage: number;
  /** Picks the armor multiplier (data/combat.ts). */
  class: WeaponClass;
  /** Decides which destructible materials it breaks. */
  ammo: AmmoType;
  /** Splash radius, px; absent means a hit only damages what it touches. */
  splash?: number;
  /** Guided: max turn rate toward the target, rad/s. */
  homing?: number;
  /** Max random deviation either side, radians. */
  spread: number;
  /**
   * Seconds between shots for the player's automatic weapons and for every enemy weapon; the
   * player's main-gun cadence comes from the Mk tier.
   */
  interval: number;
  /** Turret recoil kick in px. */
  recoil: number;
  /**
   * Lobbed (the mortar): flies in an arc over walls and levels to a chosen spot between
   * `minRange` and `range`, at `speed` px/s along the ground; `apex` is the arc's height, px.
   */
  lob?: { minRange: number; apex: number };
}

/** Quick-round refill time per round (docs/GAME_DESIGN.md: 3 × quick rounds seconds). */
export const QUICK_ROUND_REFILL_SECONDS = 3;

export const weapons: Record<WeaponId, WeaponDef> = {
  gun_105: {
    id: 'gun_105',
    projectile: 'shell_105',
    speed: 340,
    range: 320,
    damage: 40,
    class: 'cannon',
    ammo: 'standard',
    splash: 14,
    spread: 0,
    interval: 0,
    recoil: 3,
  },
  coax_mg: {
    id: 'coax_mg',
    projectile: 'bullet_mg',
    speed: 380,
    range: 200,
    damage: 3,
    class: 'small_arms',
    ammo: 'standard',
    spread: 0.05,
    interval: 0.09,
    recoil: 0,
  },
  rifle: {
    id: 'rifle',
    projectile: 'bullet_mg',
    speed: 260,
    range: 180,
    damage: 2,
    class: 'small_arms',
    ammo: 'standard',
    spread: 0.08,
    interval: 0.7,
    recoil: 0,
  },
  mg_technical: {
    id: 'mg_technical',
    projectile: 'bullet_mg',
    speed: 320,
    range: 200,
    damage: 2,
    class: 'small_arms',
    ammo: 'standard',
    spread: 0.1,
    interval: 0.14,
    recoil: 0,
  },
  mg_bunker: {
    id: 'mg_bunker',
    projectile: 'bullet_mg',
    speed: 340,
    range: 220,
    damage: 3,
    class: 'small_arms',
    ammo: 'standard',
    spread: 0.06,
    interval: 0.12,
    recoil: 0,
  },
  atgm: {
    id: 'atgm',
    projectile: 'missile_atgm',
    speed: 75,
    range: 420,
    damage: 30,
    class: 'missile',
    ammo: 'heat',
    splash: 16,
    homing: 1.4,
    spread: 0,
    interval: 6,
    recoil: 0,
  },
  gun_light_tank: {
    id: 'gun_light_tank',
    projectile: 'shell_105',
    speed: 280,
    range: 260,
    damage: 18,
    class: 'cannon',
    ammo: 'standard',
    splash: 10,
    spread: 0.02,
    interval: 2.5,
    recoil: 2,
  },
  mortar_60: {
    id: 'mortar_60',
    projectile: 'shell_mortar',
    speed: 150,
    range: 220,
    damage: 35,
    class: 'cannon',
    ammo: 'standard',
    splash: 18,
    spread: 0,
    interval: 0.9,
    recoil: 0,
    lob: { minRange: 48, apex: 48 },
  },
};

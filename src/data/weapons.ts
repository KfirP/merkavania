import type { AssetKey } from './assetManifest';

export type WeaponId = 'gun_105' | 'coax_mg';

export interface WeaponDef {
  id: WeaponId;
  projectile: AssetKey;
  /** px/s */
  speed: number;
  /** px travelled before the projectile expires */
  range: number;
  /** Unused until M3 (combat). */
  damage: number;
  /** Max random deviation either side, radians. */
  spread: number;
  /** Seconds between shots for automatic weapons; main-gun cadence comes from the Mk tier. */
  interval: number;
  /** Turret recoil kick in px. */
  recoil: number;
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
    spread: 0.05,
    interval: 0.09,
    recoil: 0,
  },
};

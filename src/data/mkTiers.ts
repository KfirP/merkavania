import type { HullStats } from '../logic/tank/hull';
import type { AssetKey } from './assetManifest';
import type { ArmorId } from './combat';
import type { WeaponId } from './weapons';

export interface MkTier {
  id: string;
  hp: number;
  armor: ArmorId;
  hull: HullStats;
  /** Turret traverse, rad/s. */
  traverseRate: number;
  /** Arcade circle body radius, px. */
  bodyRadius: number;
  /** Turret pivot offset along the hull heading, px (Merkava turrets sit toward the rear). */
  turretOffset: number;
  /** Barrel tip distance from the turret pivot, px (where shells spawn). */
  muzzleLength: number;
  mainGun: WeaponId;
  quickRounds: number;
  /** Seconds between main-gun shots. */
  gunCooldown: number;
  sprites: { hull: AssetKey; turret: AssetKey };
}

/** Every tier in the design (GAME_DESIGN.md), including those without stats yet. */
export const allMkTierIds = ['mk2', 'mk3', 'mk4'] as const;

// Only mk2 exists until M7 adds mk3; mk4 arrives with the underground biome.
export const mkTiers = {
  mk2: {
    id: 'mk2',
    hp: 100,
    armor: 'low',
    hull: {
      maxSpeed: 70,
      reverseSpeed: 40,
      accel: 60,
      brake: 160,
      drag: 90,
      turnRate: 1.8,
    },
    traverseRate: 2.2,
    bodyRadius: 13,
    turretOffset: -3,
    muzzleLength: 25,
    mainGun: 'gun_105',
    quickRounds: 6,
    gunCooldown: 0.8,
    sprites: { hull: 'mk2_hull', turret: 'mk2_turret' },
  },
} satisfies Record<string, MkTier>;

export type MkTierId = keyof typeof mkTiers;

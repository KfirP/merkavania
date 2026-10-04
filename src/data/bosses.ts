import type { AssetKey } from './assetManifest';
import type { ArmorId } from './combat';
import type { EnemyId } from './enemies';
import type { MkTierId } from './mkTiers';
import type { WeaponId } from './weapons';

/** One boss per biome (GAME_DESIGN.md, Bosses); numbers for logic/enemy/bossBrain.ts. */
export const bossIds = ['boss_desert'] as const;
export type BossId = (typeof bossIds)[number];

export interface BossDef {
  id: BossId;
  hp: number;
  armor: ArmorId;
  /** Extra damage multiplier per player weapon (the bunker's roof is weak to the mortar). */
  weakTo: Partial<Record<WeaponId, number>>;
  /** Static body, px (the bunker). */
  size: { width: number; height: number };
  /** The rail gun: slides along the chunk's `rail` polyline toward the target, telegraphs, fires. */
  gun: {
    weapon: WeaponId;
    /** px/s along the rail. */
    railSpeed: number;
    /** Seconds of warning (a blinking laser) before each shot. */
    telegraph: number;
    /** Seconds between shots. */
    interval: number;
    /** Muzzle distance from the gun's pivot, px. */
    muzzle: number;
    /** Turret traverse, rad/s. */
    traverseRate: number;
  };
  /** Seconds of intro (camera pan, radio) before the first shot. */
  intro: number;
  /** Below this share of HP the boss gets angry: faster shots and reinforcements. */
  phase2: {
    at: number;
    intervalMul: number;
    reinforcements: { enemy: EnemyId; every: number; max: number };
  };
  /** Radius of each explosion in the death chain, px. */
  blast: number;
  reward: { tier: MkTierId };
  /** Radio message keys: on waking, on defeat, and when the tank takes its reward. */
  radio: { intro: string; defeated: string; reward: string };
  sprites: { body: AssetKey; gun: AssetKey };
}

export const bosses: Record<BossId, BossDef> = {
  // A fortified command bunker with a rail-mounted gun. Its front shrugs off the 105mm, but its
  // roof does not like mortar rounds.
  boss_desert: {
    id: 'boss_desert',
    hp: 600,
    armor: 'fortified',
    weakTo: { mortar_60: 2 },
    size: { width: 96, height: 48 },
    gun: {
      weapon: 'gun_rail',
      railSpeed: 40,
      telegraph: 1.2,
      interval: 3.2,
      muzzle: 20,
      traverseRate: 1.6,
    },
    intro: 2,
    phase2: {
      at: 0.5,
      intervalMul: 0.6,
      reinforcements: { enemy: 'rifle_squad', every: 12, max: 2 },
    },
    blast: 28,
    reward: { tier: 'mk3' },
    radio: {
      intro: 'radio.desert.boss_intro',
      defeated: 'radio.desert.boss_down',
      reward: 'radio.desert.mk3',
    },
    sprites: { body: 'boss_desert_bunker', gun: 'boss_desert_gun' },
  },
};

export function isBossId(id: unknown): id is BossId {
  return typeof id === 'string' && Object.hasOwn(bosses, id);
}

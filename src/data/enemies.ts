import type { AssetKey } from './assetManifest';
import type { ArmorId } from './combat';
import type { WeaponId } from './weapons';

/** Desert enemies (GAME_DESIGN.md, Enemies). Later biomes add theirs here. */
export const enemyIds = [
  'rifle_squad',
  'technical',
  'bunker_mg',
  'atgm_team',
  'light_tank',
] as const;
export type EnemyId = (typeof enemyIds)[number];

/**
 * How an enemy fights (logic/enemy/brain.ts):
 * - `infantry` holds its ground and scatters when a tank gets close
 * - `raider` circles the player while shooting
 * - `armor` closes to firing range, then holds
 * - `static` never moves (bunkers)
 * - `missile_team` like infantry, with a long telegraph before each guided missile
 */
export const enemyBehaviours = ['infantry', 'raider', 'armor', 'static', 'missile_team'] as const;
export type EnemyBehaviour = (typeof enemyBehaviours)[number];

export interface EnemyDef {
  id: EnemyId;
  /** HP per member. */
  hp: number;
  armor: ArmorId;
  /** Has a facing, so hits from behind get the rear-arc bonus. */
  hasRear: boolean;
  behaviour: EnemyBehaviour;
  /** Members spawned from one map object (a squad is three soldiers). */
  count: number;
  /** Arcade circle body radius, px. */
  bodyRadius: number;
  /** Top speed, px/s. */
  speed: number;
  /** Hull turn rate, rad/s (vehicles). */
  turnRate: number;
  /** Aim (turret, or the soldier turning) rate, rad/s. */
  traverseRate: number;
  /** Static guns only traverse this far either side of their facing, radians. */
  aimArc?: number;
  weapon: WeaponId;
  /** Notices a visible player within this distance, px. */
  sightRange: number;
  /** Opens fire within this distance, px. */
  fireRange: number;
  /** Seconds between spotting the player and the first shot (the telegraph). */
  windup: number;
  /** Muzzle distance from the centre along the aim, px. */
  muzzle: number;
  /** Radius of the explosion when it dies, px. */
  blast: number;
  sprites: { body: AssetKey; turret?: AssetKey };
}

export const enemies: Record<EnemyId, EnemyDef> = {
  rifle_squad: {
    id: 'rifle_squad',
    hp: 8,
    armor: 'none',
    hasRear: false,
    behaviour: 'infantry',
    count: 3,
    bodyRadius: 4,
    speed: 30,
    turnRate: 8,
    traverseRate: 6,
    weapon: 'rifle',
    sightRange: 170,
    fireRange: 150,
    windup: 0.6,
    muzzle: 5,
    blast: 4,
    sprites: { body: 'enemy_rifle_soldier' },
  },
  technical: {
    id: 'technical',
    hp: 40,
    armor: 'light',
    hasRear: true,
    behaviour: 'raider',
    count: 1,
    bodyRadius: 10,
    speed: 90,
    turnRate: 2.8,
    traverseRate: 5,
    weapon: 'mg_technical',
    sightRange: 200,
    fireRange: 170,
    windup: 0.4,
    muzzle: 8,
    blast: 14,
    sprites: { body: 'enemy_technical' },
  },
  bunker_mg: {
    id: 'bunker_mg',
    hp: 150,
    armor: 'fortified',
    hasRear: true,
    behaviour: 'static',
    count: 1,
    bodyRadius: 12,
    speed: 0,
    turnRate: 0,
    traverseRate: 1.2,
    aimArc: 1.75,
    weapon: 'mg_bunker',
    sightRange: 210,
    fireRange: 200,
    windup: 0.5,
    muzzle: 12,
    blast: 18,
    sprites: { body: 'enemy_bunker' },
  },
  atgm_team: {
    id: 'atgm_team',
    hp: 16,
    armor: 'none',
    hasRear: false,
    behaviour: 'missile_team',
    count: 1,
    bodyRadius: 6,
    speed: 20,
    turnRate: 4,
    traverseRate: 1.5,
    weapon: 'atgm',
    sightRange: 260,
    fireRange: 240,
    windup: 1.5,
    muzzle: 6,
    blast: 6,
    sprites: { body: 'enemy_atgm_team' },
  },
  light_tank: {
    id: 'light_tank',
    hp: 100,
    armor: 'low',
    hasRear: true,
    behaviour: 'armor',
    count: 1,
    bodyRadius: 12,
    speed: 55,
    turnRate: 1.5,
    traverseRate: 1.4,
    weapon: 'gun_light_tank',
    sightRange: 230,
    fireRange: 200,
    windup: 0.8,
    muzzle: 18,
    blast: 20,
    sprites: { body: 'enemy_light_tank_hull', turret: 'enemy_light_tank_turret' },
  },
};

export function isEnemyId(id: unknown): id is EnemyId {
  return typeof id === 'string' && Object.hasOwn(enemies, id);
}

/** Brain tuning shared by every enemy (logic/enemy/brain.ts). */
/** Fires only when the aim is within this of the target, radians. */
export const AIM_TOLERANCE = 0.08;
/** Seconds spent hunting the last known position before giving up. */
export const SEARCH_TIME = 4;
/** Close enough to a waypoint or home, px. */
export const WAYPOINT_REACHED = 8;
/** Infantry scatter when a tank is closer than this, px… */
export const PANIC_DISTANCE = 64;
/** …running this far away each time they re-plan, px. */
export const FLEE_STEP = 48;
/** Raiders orbit at this share of their fire range… */
export const ORBIT_SHARE = 0.6;
/** …aiming this far round the circle ahead of themselves, radians. */
export const ORBIT_LEAD = 0.6;
/** Armor stops closing in at this share of its fire range. */
export const APPROACH_SHARE = 0.8;

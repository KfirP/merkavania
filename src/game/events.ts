import Phaser from 'phaser';
import type { AbilityId, MinorPickupId } from '../data/abilities';
import type { SecondaryId } from '../data/progression';
import type { WeaponId } from '../data/weapons';
import type { SaveData } from '../logic/save/save';

export interface PawnTelemetry {
  x: number;
  y: number;
  /** Radians */
  heading: number;
  speed: number;
  turretAngle: number;
  device: string;
  /** Elevation level of the cell under the pawn. */
  level: number;
  /** Id of the chunk the pawn is in. */
  chunk: string;
  hp: number;
  maxHp: number;
  /** False between the tank's death and its respawn. */
  alive: boolean;
}

export interface DestructibleTelemetry {
  /** `<chunkId>:<id>` */
  key: string;
  material: string;
  hp: number;
  x: number;
  y: number;
  level: number;
}

export interface EnemyTelemetry {
  /** Combat id: `<chunkId>:<object id>`, `#n` per squad member; debug spawns start `debug:`. */
  id: string;
  type: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  level: number;
  /** Brain mode: idle, alert, engage or search. */
  mode: string;
}

/** Debug builds only: everything spawned from chunk objects, emitted every frame. */
export interface EntitiesTelemetry {
  destructibles: DestructibleTelemetry[];
  enemies: EnemyTelemetry[];
}

/** One resolved hit, for the debug combat log and specs. */
export interface CombatHit {
  /** `player`, an enemy id or a destructible's `<chunkId>:<id>`. */
  target: string;
  weapon: WeaponId;
  damage: number;
  rear: boolean;
  ricochet: boolean;
  killed: boolean;
  /** Splash damage rather than a direct hit. */
  splash: boolean;
}

/** Debug builds only: progression objects in loaded chunks. */
export interface ObjectsTelemetry {
  pickups: { key: string; ability?: AbilityId; minor?: MinorPickupId; x: number; y: number }[];
  switches: { key: string; activatedBy: string; activated: boolean; x: number; y: number }[];
  doors: { key: string; opensWith: string; x: number; y: number }[];
  depots: { key: string; x: number; y: number }[];
  boulders: { key: string; x: number; y: number }[];
}

/** The selected secondary weapon and what the tank carries. */
export interface Loadout {
  selected: SecondaryId;
  unlocked: SecondaryId[];
  /** Rounds left in the selected secondary; null when unlimited. */
  ammo: number | null;
  capacity: number | null;
  /** Rounds left per limited secondary. */
  rounds: Partial<Record<SecondaryId, number>>;
}

export interface WorldState {
  /** Chunk the pawn is in. */
  chunk: string;
  /** Every loaded chunk id. */
  loaded: string[];
}

/** Event name → payload. Scenes communicate only through this bus and the shared GameState. */
export interface GameEvents {
  'weapon:fired': { weapon: WeaponId };
  /** Main-gun quick rounds; emitted when the displayed value changes. */
  'gun:state': { rounds: number; max: number; refillRemaining: number };
  /** Anything with HP changed it; `target` is `player`, an enemy id or a destructible key. */
  'hp:changed': { target: string; hp: number; max: number };
  'combat:hit': CombatHit;
  /** An enemy or destructible was destroyed. */
  'entity:destroyed': { id: string; kind: 'enemy' | 'destructible' };
  'player:died': undefined;
  'player:respawned': undefined;
  /** A pickup was taken (and the game saved). */
  'pickup:collected': { key: string; ability?: AbilityId; minor?: MinorPickupId };
  /** The tank rolled onto a depot: healed, rearmed and (if `saved`) written to its slot. */
  'depot:used': { key: string; saved: boolean };
  'switch:activated': { key: string };
  'door:opened': { key: string };
  /** The selected secondary, unlocked secondaries or their ammo changed. */
  'loadout:changed': Loadout;
  /** A mortar shell came down at world (x, y) on `level`. */
  'mortar:landed': { x: number; y: number; level: number };
  /** The pawn entered another chunk, or chunks were streamed in or out. */
  'world:chunks': WorldState;
  /** Debug builds only: emitted every frame by WorldScene. */
  'debug:pawn': PawnTelemetry;
  /** Debug builds only: emitted every frame by WorldScene. */
  'debug:entities': EntitiesTelemetry;
  /** Debug builds only: emitted every frame by WorldScene. */
  'debug:objects': ObjectsTelemetry;
  /** Debug builds only: the GameState as it would be saved, emitted every frame. */
  'debug:state': SaveData;
  'debug:grantAbility': { ability: AbilityId };
  'debug:toggleBodies': undefined;
  'debug:toggleElevation': undefined;
  /** Moves the active pawn and stops it; `heading` in radians, kept if omitted. */
  'debug:teleport': { x: number; y: number; heading?: number };
  /** Deals `amount` damage to the player, ignoring armor. */
  'debug:damagePlayer': { amount: number };
  'debug:god': { on: boolean };
  /** Spawns an enemy at world (x, y); `facing` in radians. */
  'debug:spawnEnemy': { type: string; x: number; y: number; facing: number };
}

type EventName = keyof GameEvents & string;

class TypedEventBus {
  private readonly emitter = new Phaser.Events.EventEmitter();
  private readonly last = new Map<EventName, unknown>();

  /**
   * The last payload emitted for `event`. Overlay scenes start after WorldScene's first emits,
   * so they read the current value here and then follow the event.
   */
  latest<K extends EventName>(event: K): GameEvents[K] | undefined {
    return this.last.get(event) as GameEvents[K] | undefined;
  }

  on<K extends EventName>(event: K, fn: (payload: GameEvents[K]) => void, context?: unknown): this {
    this.emitter.on(event, fn, context);
    return this;
  }

  off<K extends EventName>(
    event: K,
    fn: (payload: GameEvents[K]) => void,
    context?: unknown,
  ): this {
    this.emitter.off(event, fn, context);
    return this;
  }

  emit<K extends EventName>(event: K, payload: GameEvents[K]): boolean {
    this.last.set(event, payload);
    return this.emitter.emit(event, payload);
  }
}

export const events = new TypedEventBus();

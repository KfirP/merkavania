import Phaser from 'phaser';
import type { AbilityId, MinorPickupId } from '../data/abilities';
import type { MkTierId } from '../data/mkTiers';
import type { RadioSpeaker } from '../data/radio';
import type { SecondaryId } from '../data/progression';
import type { PawnKind } from '../data/terrain';
import type { DeployRefusal } from '../logic/pawn/hatch';
import type { WeaponId } from '../data/weapons';
import type { SaveData } from '../logic/save/save';

export interface PawnTelemetry {
  /** Which pawn this is: the tank, or the scout while it's out. */
  kind: PawnKind;
  x: number;
  y: number;
  /** Radians (the scout's facing). */
  heading: number;
  speed: number;
  /** The turret's angle, or where the scout aims. */
  turretAngle: number;
  device: string;
  /** Elevation level of the cell under the pawn. */
  level: number;
  /** Id of the chunk the pawn is in. */
  chunk: string;
  hp: number;
  maxHp: number;
  /** False between the pawn's death and its respawn (or, for the scout, its removal). */
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

export interface MapState {
  biome: string;
  chunks: { id: string; cx: number; cy: number }[];
  /** Ids of the chunks visited in this biome. */
  visited: string[];
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
  /** Control moved to another pawn (the scout climbed out, or is back in the tank). */
  'pawn:switched': { kind: PawnKind };
  /** The hatch was pressed but stayed shut. */
  'hatch:refused': { reason: DeployRefusal };
  /** The scout went down; control is back with the tank. */
  'scout:died': undefined;
  /** The abilities the tank has (on start, and whenever one is gained). */
  'abilities:changed': { abilities: AbilityId[] };
  /** A pickup was taken (and the game saved). */
  'pickup:collected': { key: string; ability?: AbilityId; minor?: MinorPickupId };
  /** Repair kit charges left and how many the kits hold (on start, and whenever either changes). */
  'repair:changed': { charges: number; capacity: number };
  /** A repair kit charge was spent; the tank gained `hp`. */
  'repair:used': { hp: number };
  /** The tank rolled onto a depot: healed, rearmed and (if `saved`) written to its slot. */
  'depot:used': { key: string; saved: boolean };
  'switch:activated': { key: string };
  'door:opened': { key: string };
  /** The selected secondary, unlocked secondaries or their ammo changed. */
  'loadout:changed': Loadout;
  /** A mortar shell came down at world (x, y) on `level`. */
  'mortar:landed': { x: number; y: number; level: number };
  /** The tank's Mk tier (on start, and when it's upgraded). */
  'tank:tier': { mk: MkTierId };
  /** A radio message to show (HudScene queues them). */
  'radio:message': { messageKey: string; speaker: RadioSpeaker };
  /** Skip/fast-forward the radio message on screen (interact: Space, A). */
  'radio:skip': undefined;
  /** The world's chunk grid and the chunks visited (on start, and when a new one is visited). */
  'map:changed': MapState;
  /** The pawn entered another chunk, or chunks were streamed in or out. */
  'world:chunks': WorldState;
  /** Pause the game if it's running (the rotate-device prompt went up). */
  'ui:pause': undefined;
  /** Debug builds only: emitted every frame by WorldScene. */
  'debug:pawn': PawnTelemetry;
  /** Debug builds only: the tank, emitted every frame (also while the scout is the active pawn). */
  'debug:tank': PawnTelemetry;
  /** Debug builds only: emitted every frame by WorldScene. */
  'debug:entities': EntitiesTelemetry;
  /** Debug builds only: emitted every frame by WorldScene. */
  'debug:objects': ObjectsTelemetry;
  /** Debug builds only: the GameState as it would be saved, emitted every frame. */
  'debug:state': SaveData;
  'debug:grantAbility': { ability: AbilityId };
  'debug:setMk': { mk: MkTierId };
  'debug:toggleBodies': undefined;
  'debug:toggleElevation': undefined;
  /** Moves the active pawn and stops it; `heading` in radians, kept if omitted. */
  'debug:teleport': { x: number; y: number; heading?: number };
  /** Deals `amount` damage to the player, ignoring armor. */
  'debug:damagePlayer': { amount: number };
  /** Deals `amount` damage to the scout (if it's out), ignoring armor. */
  'debug:damageScout': { amount: number };
  /** Presses the rear hatch, as `cmd.hatch` would. */
  'debug:hatch': undefined;
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

import Phaser from 'phaser';
import type { WeaponId } from '../data/weapons';

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

/** Debug builds only: everything spawned from chunk objects, emitted every frame. */
export interface EntitiesTelemetry {
  destructibles: DestructibleTelemetry[];
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
  /** The pawn entered another chunk, or chunks were streamed in or out. */
  'world:chunks': WorldState;
  /** Debug builds only: emitted every frame by WorldScene. */
  'debug:pawn': PawnTelemetry;
  /** Debug builds only: emitted every frame by WorldScene. */
  'debug:entities': EntitiesTelemetry;
  'debug:toggleBodies': undefined;
  'debug:toggleElevation': undefined;
  /** Moves the active pawn and stops it; `heading` in radians, kept if omitted. */
  'debug:teleport': { x: number; y: number; heading?: number };
  /** Deals `amount` damage to the player, ignoring armor. */
  'debug:damagePlayer': { amount: number };
  'debug:god': { on: boolean };
}

type EventName = keyof GameEvents & string;

class TypedEventBus {
  private readonly emitter = new Phaser.Events.EventEmitter();

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
    return this.emitter.emit(event, payload);
  }
}

export const events = new TypedEventBus();

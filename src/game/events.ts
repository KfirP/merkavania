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
  /** The pawn entered another chunk, or chunks were streamed in or out. */
  'world:chunks': WorldState;
  /** Debug builds only: emitted every frame by WorldScene. */
  'debug:pawn': PawnTelemetry;
  'debug:toggleBodies': undefined;
  'debug:toggleElevation': undefined;
  /** Moves the active pawn and stops it; `heading` in radians, kept if omitted. */
  'debug:teleport': { x: number; y: number; heading?: number };
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

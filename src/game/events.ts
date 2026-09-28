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
}

/** Event name → payload. Scenes communicate only through this bus and the shared GameState. */
export interface GameEvents {
  'weapon:fired': { weapon: WeaponId };
  /** Main-gun quick rounds; emitted when the displayed value changes. */
  'gun:state': { rounds: number; max: number; refillRemaining: number };
  /** Debug builds only: emitted every frame by WorldScene. */
  'debug:pawn': PawnTelemetry;
  'debug:toggleBodies': undefined;
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

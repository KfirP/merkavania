import Phaser from 'phaser';

/** Event name → payload. Scenes communicate only through this bus and the shared GameState. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- filled in from M1 onward
export interface GameEvents {}

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

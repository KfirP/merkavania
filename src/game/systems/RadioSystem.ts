import type { RadioSpeaker } from '../../data/radio';
import { stepRadios } from '../../logic/world/radio';
import { events } from '../events';
import type { ProgressionSystem } from './ProgressionSystem';
import type { SpawnSystem } from './SpawnSystem';

/**
 * Radio triggers (logic/world/radio.ts): plays a `radio` object's message when the active pawn
 * enters it, remembering `once` ones in the save. Scripted messages (boss, Mk upgrade) go through
 * `play`. HudScene queues and shows them.
 */
export class RadioSystem {
  private inside = new Set<string>();

  constructor(
    private readonly spawner: SpawnSystem,
    private readonly progression: ProgressionSystem,
  ) {}

  update(pos: { x: number; y: number }): void {
    const { flags } = this.progression.state;
    const { fire, inside } = stepRadios(this.spawner.radios, pos, this.inside, (k) => flags.has(k));
    this.inside = inside;
    for (const spec of fire) {
      if (spec.once) this.progression.hearRadio(spec.key);
      this.play(spec.messageKey, spec.speaker);
    }
  }

  play(messageKey: string, speaker: RadioSpeaker = 'command'): void {
    events.emit('radio:message', { messageKey, speaker });
  }
}

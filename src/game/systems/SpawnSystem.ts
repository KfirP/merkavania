import Phaser from 'phaser';
import { isMaterialId, materials } from '../../data/materials';
import type { WorldFlags } from '../../logic/state/flags';
import { parseChunkObjects, type RawObject } from '../../logic/world/objects';
import { levelAt, type CellLookup } from '../../logic/world/traversal';
import type { WorldChunk } from '../../logic/world/world';
import { Destructible } from '../entities/Destructible';
import { events, type DestructibleTelemetry } from '../events';
import type { CombatSystem } from './CombatSystem';
import type { EffectsSystem } from './EffectsSystem';

/** Debris blast radius for a broken destructible, px. */
const DEBRIS_RADIUS = 10;

/**
 * Builds entities from each chunk's `objects` layer as it streams in, and removes them when it
 * streams out (docs/ARCHITECTURE.md, Objects). Broken destructibles are remembered in WorldFlags.
 */
export class SpawnSystem {
  /** Static bodies the tank collides with (destructibles). */
  readonly solids: Phaser.Physics.Arcade.StaticGroup;
  private readonly byChunk = new Map<string, Phaser.GameObjects.GameObject[]>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly combat: CombatSystem,
    private readonly effects: EffectsSystem,
    private readonly flags: WorldFlags,
    private readonly cellAt: CellLookup,
  ) {
    this.solids = scene.physics.add.staticGroup();
  }

  onLoad(chunk: WorldChunk, raw: readonly RawObject[]): void {
    const spawned: Phaser.GameObjects.GameObject[] = [];
    const { destructibles } = parseChunkObjects(chunk, raw);
    for (const spec of destructibles) {
      if (this.flags.has(spec.key) || !isMaterialId(spec.material)) continue;
      const level = levelAt(spec.x, spec.y, this.cellAt);
      const d = new Destructible(this.scene, spec, materials[spec.material], level, (b) =>
        this.broken(b),
      );
      this.solids.add(d);
      this.combat.add(d);
      spawned.push(d);
    }
    this.byChunk.set(chunk.id, spawned);
  }

  onUnload(chunk: WorldChunk): void {
    for (const o of this.byChunk.get(chunk.id) ?? []) if (o.active) o.destroy();
    this.byChunk.delete(chunk.id);
  }

  destroy(): void {
    for (const id of [...this.byChunk.keys()]) this.onUnload({ id } as WorldChunk);
  }

  /** Debug: every live destructible. */
  destructibles(): DestructibleTelemetry[] {
    return (this.solids.getChildren() as Destructible[]).map((d) => ({
      key: d.combatId,
      material: d.material.id,
      hp: d.hp,
      x: d.x,
      y: d.y,
      level: d.level,
    }));
  }

  private broken(d: Destructible): void {
    this.flags.set(d.combatId);
    this.effects.explosion(d.x, d.y, DEBRIS_RADIUS, d.depth + 1);
    events.emit('entity:destroyed', { id: d.combatId, kind: 'destructible' });
  }
}

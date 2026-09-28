import Phaser from 'phaser';
import { enemies as enemyDefs, isEnemyId } from '../../data/enemies';
import { isMaterialId, materials } from '../../data/materials';
import type { WorldFlags } from '../../logic/state/flags';
import { parseChunkObjects, type EnemySpec, type RawObject } from '../../logic/world/objects';
import { levelAt, type CellLookup } from '../../logic/world/traversal';
import type { WorldChunk } from '../../logic/world/world';
import { Destructible } from '../entities/Destructible';
import { Enemy } from '../entities/Enemy';
import { events, type DestructibleTelemetry, type EnemyTelemetry } from '../events';
import type { CombatSystem } from './CombatSystem';
import type { EffectsSystem } from './EffectsSystem';

/** Debris blast radius for a broken destructible, px. */
const DEBRIS_RADIUS = 10;
/** Where squad members stand around their map object, px. */
const SQUAD_OFFSETS = [
  { x: 0, y: 0 },
  { x: -10, y: 8 },
  { x: 10, y: 8 },
  { x: 0, y: 16 },
];
/** Specs spawned through the debug hook live under this pseudo-chunk. */
const DEBUG_CHUNK = 'debug';

/**
 * Builds entities from each chunk's `objects` layer as it streams in, and removes them when it
 * streams out (docs/ARCHITECTURE.md, Objects). Broken destructibles are remembered in WorldFlags;
 * enemies respawn whenever their chunk reloads or the player respawns.
 */
export class SpawnSystem {
  /** Static bodies the tank collides with (destructibles). */
  readonly solids: Phaser.Physics.Arcade.StaticGroup;
  readonly enemies: Phaser.Physics.Arcade.Group;
  private readonly byChunk = new Map<string, Phaser.GameObjects.GameObject[]>();
  /** Enemy specs of each loaded chunk, to respawn them on a reset. */
  private readonly enemySpecs = new Map<string, EnemySpec[]>();
  private debugCount = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly combat: CombatSystem,
    private readonly effects: EffectsSystem,
    private readonly flags: WorldFlags,
    private readonly cellAt: CellLookup,
  ) {
    this.solids = scene.physics.add.staticGroup();
    this.enemies = scene.physics.add.group({ allowGravity: false });
  }

  onLoad(chunk: WorldChunk, raw: readonly RawObject[]): void {
    const spawned: Phaser.GameObjects.GameObject[] = [];
    const { destructibles, enemies } = parseChunkObjects(chunk, raw);
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
    this.enemySpecs.set(chunk.id, enemies);
    for (const spec of enemies) this.spawnEnemies(chunk.id, spec);
  }

  onUnload(chunk: WorldChunk): void {
    for (const o of this.byChunk.get(chunk.id) ?? []) if (o.active) o.destroy();
    this.byChunk.delete(chunk.id);
    this.enemySpecs.delete(chunk.id);
  }

  destroy(): void {
    for (const id of [...this.byChunk.keys()]) this.onUnload({ id } as WorldChunk);
  }

  /** The player respawned: every enemy comes back fresh, and debug spawns are dropped. */
  resetEnemies(): void {
    for (const e of [...this.enemies.getChildren()] as Enemy[]) e.destroy();
    this.byChunk.delete(DEBUG_CHUNK);
    for (const [chunkId, specs] of this.enemySpecs) {
      const kept = (this.byChunk.get(chunkId) ?? []).filter((o) => o.active);
      this.byChunk.set(chunkId, kept);
      for (const spec of specs) this.spawnEnemies(chunkId, spec);
    }
  }

  /** Debug: spawns an enemy (a whole squad for `rifle_squad`) at world (x, y). */
  spawnDebugEnemy(type: string, x: number, y: number, facing: number): void {
    if (!isEnemyId(type)) {
      console.warn(`spawnEnemy: unknown enemy type "${type}"`);
      return;
    }
    const key = `${DEBUG_CHUNK}:${type}_${++this.debugCount}`;
    this.spawnEnemies(DEBUG_CHUNK, { key, enemyType: type, level: 0, x, y, facing });
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

  /** Debug: every live enemy. */
  enemyTelemetry(): EnemyTelemetry[] {
    return (this.enemies.getChildren() as Enemy[]).map((e) => ({
      id: e.combatId,
      type: e.def.id,
      hp: e.hp,
      maxHp: e.maxHp,
      x: e.pos.x,
      y: e.pos.y,
      level: e.level,
      mode: e.mode,
    }));
  }

  private spawnEnemies(chunkId: string, spec: EnemySpec): void {
    if (!isEnemyId(spec.enemyType)) return;
    const def = enemyDefs[spec.enemyType];
    const list = this.byChunk.get(chunkId) ?? [];
    for (let i = 0; i < def.count; i++) {
      const off = SQUAD_OFFSETS[i % SQUAD_OFFSETS.length]!;
      const x = spec.x + off.x;
      const y = spec.y + off.y;
      const level = levelAt(x, y, this.cellAt);
      const id = def.count > 1 ? `${spec.key}#${i}` : spec.key;
      const e = new Enemy(this.scene, id, def, { ...spec, level }, x, y, (dead) =>
        this.killed(dead),
      );
      this.enemies.add(e);
      e.configureBody();
      this.combat.add(e);
      list.push(e);
    }
    this.byChunk.set(chunkId, list);
  }

  private killed(e: Enemy): void {
    const { x, y } = e.pos;
    this.effects.explosion(x, y, e.def.blast, e.depth + 1);
    events.emit('entity:destroyed', { id: e.combatId, kind: 'enemy' });
  }

  private broken(d: Destructible): void {
    this.flags.set(d.combatId);
    this.effects.explosion(d.x, d.y, DEBRIS_RADIUS, d.depth + 1);
    events.emit('entity:destroyed', { id: d.combatId, kind: 'destructible' });
  }
}

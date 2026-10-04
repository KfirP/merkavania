import Phaser from 'phaser';
import { enemies as enemyDefs, isEnemyId } from '../../data/enemies';
import { isMaterialId, materials } from '../../data/materials';
import type { WorldFlags } from '../../logic/state/flags';
import {
  parseChunkObjects,
  type EnemySpec,
  type RadioSpec,
  type RawObject,
} from '../../logic/world/objects';
import { levelAt, type CellLookup } from '../../logic/world/traversal';
import type { WorldChunk } from '../../logic/world/world';
import { Boulder } from '../entities/Boulder';
import { Depot } from '../entities/Depot';
import { Destructible } from '../entities/Destructible';
import { Door } from '../entities/Door';
import { Enemy } from '../entities/Enemy';
import { Pickup } from '../entities/Pickup';
import { Switch } from '../entities/Switch';
import {
  events,
  type DestructibleTelemetry,
  type EnemyTelemetry,
  type ObjectsTelemetry,
} from '../events';
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
 * streams out (docs/ARCHITECTURE.md, Objects). Taken pickups, broken destructibles and flipped
 * switches are remembered in the GameState's WorldFlags (a door stays open once its switch is
 * flipped); enemies respawn whenever their chunk reloads or the player respawns, and boulders go
 * back to their spot when their chunk reloads.
 */
export class SpawnSystem {
  /** Static bodies the tank collides with (destructibles). */
  readonly solids: Phaser.Physics.Arcade.StaticGroup;
  readonly enemies: Phaser.Physics.Arcade.Group;
  readonly pickups: Phaser.Physics.Arcade.StaticGroup;
  readonly switches: Phaser.Physics.Arcade.StaticGroup;
  /** Closed doors: block movement, and fire on their level and above. */
  readonly doors: Phaser.Physics.Arcade.StaticGroup;
  readonly boulders: Phaser.Physics.Arcade.Group;
  private readonly depots = new Set<Depot>();
  private readonly byChunk = new Map<string, Phaser.GameObjects.GameObject[]>();
  /** Enemy specs of each loaded chunk, to respawn them on a reset. */
  private readonly enemySpecs = new Map<string, EnemySpec[]>();
  /** Radio triggers of each loaded chunk (RadioSystem reads them). */
  private readonly radioSpecs = new Map<string, RadioSpec[]>();
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
    this.pickups = scene.physics.add.staticGroup();
    this.switches = scene.physics.add.staticGroup();
    this.doors = scene.physics.add.staticGroup();
    this.boulders = scene.physics.add.group({ allowGravity: false });
  }

  onLoad(chunk: WorldChunk, raw: readonly RawObject[]): void {
    const spawned: Phaser.GameObjects.GameObject[] = [];
    const { destructibles, enemies, pickups, depots, switches, doors, boulders, radios } =
      parseChunkObjects(chunk, raw);
    this.radioSpecs.set(chunk.id, radios);
    const levelOf = (p: { x: number; y: number }) => levelAt(p.x, p.y, this.cellAt);
    for (const spec of pickups) {
      if (this.flags.has(spec.key)) continue;
      const p = new Pickup(this.scene, spec, levelOf(spec));
      this.pickups.add(p);
      spawned.push(p);
    }
    for (const spec of depots) {
      const d = new Depot(this.scene, spec, levelOf(spec));
      this.depots.add(d);
      d.once(Phaser.GameObjects.Events.DESTROY, () => this.depots.delete(d));
      spawned.push(d);
    }
    for (const spec of switches) {
      const sw = new Switch(this.scene, spec, levelOf(spec), this.flags.has(spec.key), (on) =>
        this.switched(on),
      );
      this.switches.add(sw);
      this.combat.addTrigger(sw);
      spawned.push(sw);
    }
    for (const spec of doors) {
      if (this.flags.has(spec.opensWith)) continue;
      const door = new Door(this.scene, spec, levelOf(spec));
      this.doors.add(door);
      spawned.push(door);
    }
    for (const spec of boulders) {
      const b = new Boulder(this.scene, spec, levelOf(spec));
      this.boulders.add(b);
      b.configureBody();
      spawned.push(b);
    }
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
    this.radioSpecs.delete(chunk.id);
  }

  /** Radios in the loaded chunks, in chunk-load and map order. */
  get radios(): RadioSpec[] {
    return [...this.radioSpecs.values()].flat();
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

  /** A taken pickup leaves the world (its flag is set by the GameState). */
  removePickup(p: Pickup): void {
    p.destroy();
  }

  /**
   * Whether a closed door, destructible or boulder on `level` covers the circle at (x, y), e.g.
   * the spot behind the tank where the scout would climb out.
   */
  blocksAt(x: number, y: number, radius: number, level: number): boolean {
    const groups = [this.doors, this.solids, this.boulders];
    return this.scene.physics.overlapCirc(x, y, radius, true, true).some((body) => {
      const o = body.gameObject as Phaser.GameObjects.GameObject & { level?: number };
      return o.level === level && groups.some((g) => g.contains(o));
    });
  }

  /** World rects of the closed doors (recall routes go around them). */
  doorRects(): Phaser.Geom.Rectangle[] {
    return (this.doors.getChildren() as Door[]).map((d) => d.getBounds());
  }

  /** The depot pad under world (x, y) on `level`, if any. */
  depotAt(x: number, y: number, level: number): Depot | null {
    for (const d of this.depots) if (d.level === level && d.contains(x, y)) return d;
    return null;
  }

  /** Debug: progression objects in the loaded chunks. */
  objectTelemetry(): ObjectsTelemetry {
    return {
      pickups: (this.pickups.getChildren() as Pickup[]).map(({ spec }) => ({ ...spec })),
      switches: (this.switches.getChildren() as Switch[]).map((s) => ({
        key: s.spec.key,
        activatedBy: s.spec.activatedBy,
        activated: s.activated,
        x: s.x,
        y: s.y,
      })),
      doors: (this.doors.getChildren() as Door[]).map(({ spec }) => ({
        key: spec.key,
        opensWith: spec.opensWith,
        x: spec.x,
        y: spec.y,
      })),
      depots: [...this.depots].map(({ spec }) => ({ key: spec.key, x: spec.x, y: spec.y })),
      boulders: (this.boulders.getChildren() as Boulder[]).map((b) => ({
        key: b.spec.key,
        x: b.pos.x,
        y: b.pos.y,
      })),
    };
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

  /** A switch flipped: remember it and open its doors. */
  private switched(sw: Switch): void {
    this.flags.set(sw.spec.key);
    events.emit('switch:activated', { key: sw.spec.key });
    for (const door of [...this.doors.getChildren()] as Door[]) {
      if (door.spec.opensWith !== sw.spec.key) continue;
      this.doors.remove(door);
      door.open();
      events.emit('door:opened', { key: door.spec.key });
    }
  }

  private broken(d: Destructible): void {
    this.flags.set(d.combatId);
    this.effects.explosion(d.x, d.y, DEBRIS_RADIUS, d.depth + 1);
    events.emit('entity:destroyed', { id: d.combatId, kind: 'destructible' });
  }
}

import Phaser from 'phaser';
import { getAsset } from '../../data/assetManifest';
import { RESPAWN_DELAY } from '../../data/combat';
import { crushes } from '../../logic/combat/crush';
import { closestAlive } from '../../logic/enemy/target';
import { hazardDamage } from '../../logic/combat/hazard';
import { CHUNK_H, CHUNK_PX_H, CHUNK_PX_W, CHUNK_W, TILE } from '../../logic/world/chunks';
import { ABOVE_DEPTH } from '../../logic/world/depth';
import { WorldGrid } from '../../logic/world/grid';
import { findDepot, type RawObject } from '../../logic/world/objects';
import { wallBlocksProjectile } from '../../logic/world/traversal';
import {
  findSpawn,
  parseWorld,
  worldBounds,
  type TiledWorld,
  type ParsedWorld,
} from '../../logic/world/world';
import { isDebug } from '../debug';
import { Boulder } from '../entities/Boulder';
import type { Door } from '../entities/Door';
import type { Enemy, EnemyContext } from '../entities/Enemy';
import type { Pickup } from '../entities/Pickup';
import { Projectile } from '../entities/Projectile';
import type { Scout } from '../entities/Scout';
import { Tank } from '../entities/Tank';
import { events, type GameEvents, type PawnTelemetry } from '../events';
import { ChunkStreamer } from '../systems/ChunkStreamer';
import { CombatSystem } from '../systems/CombatSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { ElevationSystem } from '../systems/ElevationSystem';
import { InputSystem } from '../systems/InputSystem';
import { MortarSystem } from '../systems/MortarSystem';
import { PawnSystem } from '../systems/PawnSystem';
import { ProgressionSystem, slotFromUrl } from '../systems/ProgressionSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { SceneKey } from './keys';

/** Longest step fed to pawns, so a tab-switch hitch doesn't launch the tank through a wall. */
const MAX_DT = 1 / 20;
const WORLD_KEY = 'world_test';
/** Camera fade around a respawn, ms. */
const FADE_MS = 400;
/** The tank faces north at the start spawn and at depots. */
const SPAWN_HEADING = -Math.PI / 2;

/** Debug elevation tint per level (0 is left clear), plus ramps and chunk borders. */
const LEVEL_TINTS = [0x000000, 0xe8d24a, 0xe8883a, 0xd6453e];
const RAMP_TINT = 0x3ec7d6;
const STEEP_TINT = 0xb00020;

/** Gameplay scene: streams the world's chunks around the tank. */
export class WorldScene extends Phaser.Scene {
  private tank!: Tank;
  private inputSystem!: InputSystem;
  private streamer!: ChunkStreamer;
  private elevation!: ElevationSystem;
  private projectiles!: ProjectileSystem;
  private effects!: EffectsSystem;
  private combat!: CombatSystem;
  private spawner!: SpawnSystem;
  private enemyContext!: EnemyContext;
  private grid!: WorldGrid;
  private world!: ParsedWorld;
  private progression!: ProgressionSystem;
  private mortar!: MortarSystem;
  private pawns!: PawnSystem;
  /** Depot pad the tank is on, so a depot fires once per visit. */
  private onDepot: string | null = null;
  private elevationOverlay: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super(SceneKey.World);
  }

  create(data: { slot?: number } = {}): void {
    const world = parseWorld(
      this.cache.json.get(WORLD_KEY) as TiledWorld,
      getAsset(WORLD_KEY).path,
    );
    this.world = world;
    this.progression = new ProgressionSystem(data.slot ?? slotFromUrl());
    const state = this.progression.state;
    this.grid = new WorldGrid();
    this.elevation = new ElevationSystem(this.grid, () => state.abilities);
    this.projectiles = new ProjectileSystem(this, this.elevation.cellAt);
    this.effects = new EffectsSystem(this);
    this.combat = new CombatSystem(this, this.projectiles, this.effects);
    this.mortar = new MortarSystem(this, this.combat, this.elevation.cellAt);

    const spawn = this.respawnPoint();
    this.onDepot = state.depot;
    this.tank = new Tank(
      this,
      spawn.x,
      spawn.y,
      state.mk,
      spawn.heading,
      this.projectiles,
      this.progression,
      this.mortar,
      this.progression.maxHp,
    );
    this.combat.add(this.tank);
    this.combat.watch(this.tank);
    events.on('player:died', this.onPlayerDied, this);

    this.spawner = new SpawnSystem(
      this,
      this.combat,
      this.effects,
      state.flags,
      this.elevation.cellAt,
    );
    this.combat.watch(this.spawner.solids);
    this.combat.watch(this.spawner.enemies);
    this.combat.watchTriggers(this.spawner.switches);
    this.addEntityColliders();
    const pawns = new PawnSystem(this, this.tank, {
      combat: this.combat,
      effects: this.effects,
      projectiles: this.projectiles,
      spawner: this.spawner,
      elevation: this.elevation,
      progression: this.progression,
      onPickup: (p) => this.collect(p),
    });
    this.pawns = pawns;
    this.projectiles.onTrail = (p) => this.effects.trail(p.x, p.y, p.depth);
    this.projectiles.homingTarget = (owner, from) =>
      owner === 'enemy' ? (closestAlive(from, pawns.players)?.pos ?? null) : null;
    this.enemyContext = {
      get players() {
        return pawns.players;
      },
      cellAt: this.elevation.cellAt,
      projectiles: this.projectiles,
    };
    events.on('player:respawned', this.onPlayerRespawned, this);
    events.on('world:chunks', this.onChunks, this);

    this.streamer = new ChunkStreamer(
      this,
      world,
      this.grid,
      (walls) => [
        this.physics.add.collider(this.tank, walls),
        this.physics.add.collider(this.spawner.enemies, walls),
        this.physics.add.collider(this.spawner.boulders, walls),
        this.projectiles.addWalls(walls),
        ...this.pawns.wallColliders(walls),
      ],
      this.spawner,
    );
    this.streamer.update(this.tank.x, this.tank.y);

    const b = worldBounds(world.chunks);
    this.physics.world.setBounds(b.x, b.y, b.width, b.height);
    this.cameras.main
      .setBounds(b.x, b.y, b.width, b.height)
      .startFollow(this.tank, true, 0.15, 0.15);

    this.inputSystem = new InputSystem(this);

    this.progression.emitLoadout();
    this.progression.emitAbilities();
    this.scene.launch(SceneKey.Hud);
    events.emit('hp:changed', { target: 'player', hp: this.tank.hp, max: this.tank.maxHp });
    if (this.sys.game.device.input.touch) this.scene.launch(SceneKey.TouchControls);
    if (isDebug()) {
      this.scene.launch(SceneKey.Debug);
      events.on('debug:toggleBodies', this.toggleBodies, this);
      events.on('debug:toggleElevation', this.toggleElevation, this);
      events.on('debug:teleport', this.teleport, this);
      events.on('debug:damagePlayer', this.debugDamage, this);
      events.on('debug:damageScout', this.debugDamageScout, this);
      events.on('debug:god', this.debugGod, this);
      events.on('debug:spawnEnemy', this.debugSpawnEnemy, this);
      events.on('debug:grantAbility', this.debugGrant, this);
      events.on('world:chunks', this.redrawElevation, this);
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.inputSystem.destroy();
      this.streamer.destroy();
      this.spawner.destroy();
      this.mortar.destroy();
      this.pawns.destroy();
      events.off('debug:damageScout', this.debugDamageScout, this);
      events.off('debug:grantAbility', this.debugGrant, this);
      events.off('world:chunks', this.onChunks, this);
      events.off('debug:toggleBodies', this.toggleBodies, this);
      events.off('debug:toggleElevation', this.toggleElevation, this);
      events.off('debug:teleport', this.teleport, this);
      events.off('debug:damagePlayer', this.debugDamage, this);
      events.off('debug:god', this.debugGod, this);
      events.off('debug:spawnEnemy', this.debugSpawnEnemy, this);
      events.off('world:chunks', this.redrawElevation, this);
      events.off('player:died', this.onPlayerDied, this);
      events.off('player:respawned', this.onPlayerRespawned, this);
      this.scene.stop(SceneKey.Hud);
      this.scene.stop(SceneKey.TouchControls);
      this.scene.stop(SceneKey.Debug);
    });
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, MAX_DT);
    this.progression.tick(delta);
    // Positions come from `pos` (the body), not the sprite: Arcade has already stepped it.
    // Stream first, so the cells around the pawn exist before movement is checked against them.
    const pawn = this.pawns.active;
    const { x, y } = pawn.pos;
    this.streamer.update(x, y);
    this.elevation.prepare(this.tank);
    const cmd = this.inputSystem.update({ x, y, turretAngle: pawn.aim, dt });
    // A dead tank ignores input until it respawns; input is still polled so edges stay current.
    this.pawns.update(cmd, dt);
    this.applyHazards(dt);
    if (this.tank.alive) this.checkDepot();
    this.updateEnemies(dt);
    this.updateBoulders(dt);
    this.projectiles.update(dt);
    this.mortar.update(dt);

    if (isDebug()) {
      const tank = this.telemetry(this.tank);
      events.emit('debug:pawn', this.pawns.scout ? this.telemetry(this.pawns.scout) : tank);
      events.emit('debug:tank', tank);
      events.emit('debug:entities', {
        destructibles: this.spawner.destructibles(),
        enemies: this.spawner.enemyTelemetry(),
      });
      events.emit('debug:objects', this.spawner.objectTelemetry());
      events.emit('debug:state', this.progression.snapshot());
    }
  }

  /** Debug telemetry for a pawn, read after constrain (which may have moved it back from a cliff). */
  private telemetry(pawn: Tank | Scout): PawnTelemetry {
    const tank = pawn instanceof Tank;
    return {
      kind: pawn.kind,
      x: pawn.pos.x,
      y: pawn.pos.y,
      heading: tank ? pawn.heading : pawn.aim,
      speed: tank ? pawn.speed : pawn.body.speed,
      turretAngle: pawn.aim,
      device: this.inputSystem.active,
      level: pawn.level,
      chunk: this.streamer.currentChunk,
      hp: pawn.hp,
      maxHp: pawn.maxHp,
      alive: pawn.alive,
    };
  }

  /** The last depot used, or the `start` spawn. */
  private respawnPoint(): { x: number; y: number; heading: number } {
    const mapOf = (id: string) =>
      this.cache.tilemap.get(id).data as { layers: { name: string; objects?: RawObject[] }[] };
    const objectsOf = (id: string) =>
      mapOf(id).layers.find((l) => l.name === 'objects')?.objects ?? [];
    const depot = this.progression.state.depot;
    const at =
      (depot && findDepot(this.world.chunks, objectsOf, depot)) ||
      findSpawn(this.world.chunks, mapOf, 'start');
    if (!at) throw new Error(`${WORLD_KEY} has no start spawn`);
    return { x: at.x, y: at.y, heading: SPAWN_HEADING };
  }

  private onChunks({ chunk }: GameEvents['world:chunks']): void {
    this.progression.visit(this.world.biome, chunk);
  }

  /** Rolling onto a depot pad heals, rearms and saves, once per visit. */
  private checkDepot(): void {
    const { x, y } = this.tank.pos;
    const key = this.spawner.depotAt(x, y, this.tank.level)?.spec.key ?? null;
    if (key && key !== this.onDepot) {
      this.tank.repair();
      this.progression.depot(key);
    }
    this.onDepot = key;
  }

  private collect(p: Pickup): void {
    const taken = this.progression.collect(p.spec);
    this.spawner.removePickup(p);
    if (!taken) return;
    if (taken.hpBonus > 0) this.tank.raiseMaxHp(this.progression.maxHp);
  }

  /** Shoved boulders slide under the same elevation rules as a vehicle. */
  private updateBoulders(dt: number): void {
    for (const b of this.spawner.boulders.getChildren() as Boulder[]) {
      b.stuck = !b.body.blocked.none;
      this.elevation.prepare(b);
      this.elevation.constrain(b, dt, []);
      b.syncDepth();
    }
  }

  private updateEnemies(dt: number): void {
    for (const e of [...this.spawner.enemies.getChildren()] as Enemy[]) {
      if (!e.active) continue;
      this.elevation.prepare(e);
      e.think(this.enemyContext, dt);
      if (e.active) this.elevation.constrain(e, dt, []);
    }
  }

  /**
   * Bodies only meet on the same level (docs/ARCHITECTURE.md, Elevation). The tank shoves
   * vehicles, stops against bunkers and destructibles, and flattens soldiers.
   */
  private addEntityColliders(): void {
    const sameLevel = (a: unknown, b: unknown) =>
      (a as { level: number }).level === (b as { level: number }).level;
    this.physics.add.collider(this.tank, this.spawner.solids, undefined, sameLevel);
    this.physics.add.collider(this.tank, this.spawner.enemies, undefined, (_t, other) => {
      const e = other as Enemy;
      if (!this.tank.alive || !e.alive || e.level !== this.tank.level) return false;
      if (!crushes(e.def.behaviour, this.tank.speed)) return true;
      this.combat.damage(e, e.hp);
      return false;
    });
    this.physics.add.collider(this.spawner.enemies, this.spawner.enemies, undefined, sameLevel);
    this.physics.add.collider(this.spawner.enemies, this.spawner.solids, undefined, sameLevel);

    const { doors, boulders, pickups } = this.spawner;
    for (const movers of [this.tank, this.spawner.enemies])
      this.physics.add.collider(movers, doors, undefined, sameLevel);
    this.physics.add.collider(this.spawner.enemies, boulders, undefined, sameLevel);
    // Boulders are immovable bodies, which Arcade never separates from static ones: a shoved
    // boulder that meets a door, a destructible or another boulder jams instead.
    const jam = (a: unknown, b: unknown) => {
      if (!sameLevel(a, b)) return false;
      for (const o of [a, b]) if (o instanceof Boulder && o.body.speed > 0) o.jam();
      return false;
    };
    for (const solid of [doors, this.spawner.solids, boulders])
      this.physics.add.overlap(boulders, solid, undefined, jam);
    // The dozer blade shoves boulders ahead instead of colliding; a jammed one blocks it.
    this.physics.add.collider(this.tank, boulders, undefined, (_t, o) => {
      const b = o as Boulder;
      if (!this.tank.alive || b.level !== this.tank.level) return false;
      if (!this.progression.has('dozer_blade')) return true;
      return !b.shove(this.tank.pos, this.tank.body.velocity);
    });
    this.physics.add.overlap(
      this.tank,
      pickups,
      (_t, p) => this.collect(p as Pickup),
      (_t, p) => this.tank.alive && (p as Pickup).level === this.tank.level,
    );

    // Doors stop fire like walls (their level and below); boulders stop it on their level.
    const shot = (a: unknown, b: unknown) =>
      (a instanceof Projectile ? [a, b] : [b, a]) as [Projectile, { level: number }];
    this.physics.add.overlap(
      this.projectiles.group,
      doors,
      (a, b) => this.projectiles.impact(shot(a, b)[0]),
      (a, b) => {
        const [p, door] = shot(a, b);
        return p.active && wallBlocksProjectile((door as Door).level, p.level);
      },
    );
    this.physics.add.overlap(
      this.projectiles.group,
      boulders,
      (a, b) => this.projectiles.impact(shot(a, b)[0]),
      (a, b) => {
        const [p, boulder] = shot(a, b);
        return p.active && boulder.level === p.level;
      },
    );
  }

  private debugGrant({ ability }: GameEvents['debug:grantAbility']): void {
    this.progression.grant(ability);
  }

  private onPlayerRespawned(): void {
    this.spawner.resetEnemies();
  }

  private debugSpawnEnemy({ type, x, y, facing }: GameEvents['debug:spawnEnemy']): void {
    this.spawner.spawnDebugEnemy(type, x, y, facing);
  }

  /** Minefields and missile zones hurt a pawn without the matching ability. */
  private applyHazards(dt: number): void {
    for (const pawn of this.pawns.players) {
      if (!pawn.alive) continue;
      const { x, y } = pawn.pos;
      const cell = this.elevation.cellAt(Math.floor(x / TILE), Math.floor(y / TILE));
      const damage = hazardDamage(cell, this.elevation.abilities(), dt);
      if (damage > 0) this.combat.damage(pawn, damage);
    }
  }

  private onPlayerDied(): void {
    const { x, y } = this.tank.pos;
    this.effects.explosion(x, y, 28, this.tank.depth + 1);
    const cam = this.cameras.main;
    this.time.delayedCall(RESPAWN_DELAY * 1000 - FADE_MS, () => cam.fadeOut(FADE_MS));
    this.time.delayedCall(RESPAWN_DELAY * 1000, () => {
      const { x, y, heading } = this.respawnPoint();
      this.onDepot = this.progression.state.depot;
      this.tank.respawn(x, y, heading);
      this.streamer.update(x, y);
      this.elevation.prepare(this.tank);
      cam.fadeIn(FADE_MS);
    });
  }

  private debugDamage({ amount }: GameEvents['debug:damagePlayer']): void {
    this.combat.damage(this.tank, amount);
  }

  private debugDamageScout({ amount }: GameEvents['debug:damageScout']): void {
    if (this.pawns.scout) this.combat.damage(this.pawns.scout, amount);
  }

  private debugGod({ on }: GameEvents['debug:god']): void {
    this.combat.god = on;
  }

  private toggleBodies(): void {
    const world = this.physics.world;
    world.drawDebug = !world.drawDebug;
    if (world.drawDebug && !world.debugGraphic) world.createDebugGraphic();
    world.debugGraphic?.clear().setDepth(ABOVE_DEPTH + 1);
  }

  private teleport({ x, y, heading }: GameEvents['debug:teleport']): void {
    const pawn = this.pawns.active;
    pawn.teleport(x, y, heading);
    this.streamer.update(x, y);
    this.elevation.prepare(pawn);
  }

  private toggleElevation(): void {
    if (this.elevationOverlay) {
      this.elevationOverlay.destroy();
      this.elevationOverlay = null;
      return;
    }
    this.elevationOverlay = this.add.graphics().setDepth(ABOVE_DEPTH + 1);
    this.redrawElevation();
  }

  /** Tints each loaded cell by level (ramps cyan, steep ramps red) and outlines the chunks. */
  private redrawElevation(): void {
    const g = this.elevationOverlay;
    if (!g) return;
    g.clear();
    for (const chunk of this.streamer.loadedChunks) {
      for (let ty = 0; ty < CHUNK_H; ty++)
        for (let tx = 0; tx < CHUNK_W; tx++) {
          const wx = chunk.cx * CHUNK_W + tx;
          const wy = chunk.cy * CHUNK_H + ty;
          const cell = this.grid.cellAt(wx, wy);
          if (!cell) continue;
          const tint = cell.ramp ? (cell.steep ? STEEP_TINT : RAMP_TINT) : LEVEL_TINTS[cell.level];
          if (!cell.ramp && cell.level === 0) continue;
          g.fillStyle(tint ?? 0xffffff, 0.35).fillRect(wx * TILE, wy * TILE, TILE, TILE);
        }
      g.lineStyle(1, 0xff00ff, 0.8).strokeRect(
        chunk.cx * CHUNK_PX_W,
        chunk.cy * CHUNK_PX_H,
        CHUNK_PX_W,
        CHUNK_PX_H,
      );
    }
  }
}

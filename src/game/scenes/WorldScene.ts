import Phaser from 'phaser';
import { getAsset } from '../../data/assetManifest';
import { RESPAWN_DELAY } from '../../data/combat';
import { crushes } from '../../logic/combat/crush';
import { hazardDamage } from '../../logic/combat/hazard';
import { WorldFlags } from '../../logic/state/flags';
import { CHUNK_H, CHUNK_PX_H, CHUNK_PX_W, CHUNK_W, TILE } from '../../logic/world/chunks';
import { ABOVE_DEPTH } from '../../logic/world/depth';
import { WorldGrid } from '../../logic/world/grid';
import { findSpawn, parseWorld, worldBounds, type TiledWorld } from '../../logic/world/world';
import { isDebug } from '../debug';
import type { Enemy, EnemyContext } from '../entities/Enemy';
import { Tank } from '../entities/Tank';
import { events, type GameEvents } from '../events';
import { ChunkStreamer } from '../systems/ChunkStreamer';
import { CombatSystem } from '../systems/CombatSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { ElevationSystem } from '../systems/ElevationSystem';
import { InputSystem } from '../systems/InputSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { SceneKey } from './keys';

/** Longest step fed to pawns, so a tab-switch hitch doesn't launch the tank through a wall. */
const MAX_DT = 1 / 20;
const WORLD_KEY = 'world_test';
/** Camera fade around a respawn, ms. */
const FADE_MS = 400;

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
  /** Where the tank respawns; M4 replaces it with the last depot. */
  private respawnPoint!: { x: number; y: number; heading: number };
  private elevationOverlay: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super(SceneKey.World);
  }

  create(): void {
    const world = parseWorld(
      this.cache.json.get(WORLD_KEY) as TiledWorld,
      getAsset(WORLD_KEY).path,
    );
    this.grid = new WorldGrid();
    this.elevation = new ElevationSystem(this.grid);
    this.projectiles = new ProjectileSystem(this, this.elevation.cellAt);
    this.effects = new EffectsSystem(this);
    this.combat = new CombatSystem(this, this.projectiles, this.effects);

    const spawn = findSpawn(world.chunks, (id) => this.cache.tilemap.get(id).data, 'start');
    if (!spawn) throw new Error(`${WORLD_KEY} has no start spawn`);
    this.respawnPoint = { ...spawn, heading: -Math.PI / 2 };
    this.tank = new Tank(
      this,
      spawn.x,
      spawn.y,
      'mk2',
      this.respawnPoint.heading,
      this.projectiles,
    );
    this.combat.add(this.tank);
    this.combat.watch(this.tank);
    events.on('player:died', this.onPlayerDied, this);

    // Session-only until M4 puts it in the saved GameState.
    const flags = new WorldFlags();
    this.spawner = new SpawnSystem(this, this.combat, this.effects, flags, this.elevation.cellAt);
    this.combat.watch(this.spawner.solids);
    this.combat.watch(this.spawner.enemies);
    this.addEntityColliders();
    this.projectiles.homingTarget = (owner) =>
      owner === 'enemy' && this.tank.alive ? this.tank.pos : null;
    this.enemyContext = {
      player: this.tank,
      cellAt: this.elevation.cellAt,
      projectiles: this.projectiles,
    };
    events.on('player:respawned', this.onPlayerRespawned, this);

    this.streamer = new ChunkStreamer(
      this,
      world,
      this.grid,
      (walls) => [
        this.physics.add.collider(this.tank, walls),
        this.physics.add.collider(this.spawner.enemies, walls),
        this.projectiles.addWalls(walls),
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

    this.scene.launch(SceneKey.Hud);
    events.emit('hp:changed', { target: 'player', hp: this.tank.hp, max: this.tank.maxHp });
    if (this.sys.game.device.input.touch) this.scene.launch(SceneKey.TouchControls);
    if (isDebug()) {
      this.scene.launch(SceneKey.Debug);
      events.on('debug:toggleBodies', this.toggleBodies, this);
      events.on('debug:toggleElevation', this.toggleElevation, this);
      events.on('debug:teleport', this.teleport, this);
      events.on('debug:damagePlayer', this.debugDamage, this);
      events.on('debug:god', this.debugGod, this);
      events.on('debug:spawnEnemy', this.debugSpawnEnemy, this);
      events.on('world:chunks', this.redrawElevation, this);
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.inputSystem.destroy();
      this.streamer.destroy();
      this.spawner.destroy();
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
    // Positions come from `pos` (the body), not the sprite: Arcade has already stepped it.
    // Stream first, so the cells around the pawn exist before movement is checked against them.
    const { x, y } = this.tank.pos;
    this.streamer.update(x, y);
    this.elevation.prepare(this.tank);
    const cmd = this.inputSystem.update({ x, y, turretAngle: this.tank.aim, dt });
    // A dead tank ignores input until it respawns; input is still polled so edges stay current.
    if (this.tank.alive) {
      this.tank.applyCommand(cmd, dt);
      this.elevation.constrain(this.tank, dt);
      this.applyHazards(dt);
    }
    this.updateEnemies(dt);
    this.projectiles.update(dt);

    if (isDebug())
      events.emit('debug:pawn', {
        // After constrain, which may have moved the body back from a cliff.
        ...this.tank.pos,
        heading: this.tank.heading,
        speed: this.tank.speed,
        turretAngle: this.tank.aim,
        device: this.inputSystem.active,
        level: this.tank.level,
        chunk: this.streamer.currentChunk,
        hp: this.tank.hp,
        maxHp: this.tank.maxHp,
        alive: this.tank.alive,
      });
    if (isDebug())
      events.emit('debug:entities', {
        destructibles: this.spawner.destructibles(),
        enemies: this.spawner.enemyTelemetry(),
      });
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
  }

  private onPlayerRespawned(): void {
    this.spawner.resetEnemies();
  }

  private debugSpawnEnemy({ type, x, y, facing }: GameEvents['debug:spawnEnemy']): void {
    this.spawner.spawnDebugEnemy(type, x, y, facing);
  }

  /** Minefields and missile zones hurt a tank without the matching ability. */
  private applyHazards(dt: number): void {
    const { x, y } = this.tank.pos;
    const cell = this.elevation.cellAt(Math.floor(x / TILE), Math.floor(y / TILE));
    const damage = hazardDamage(cell, this.elevation.abilities(), dt);
    if (damage > 0) this.combat.damage(this.tank, damage);
  }

  private onPlayerDied(): void {
    const { x, y } = this.tank.pos;
    this.effects.explosion(x, y, 28, this.tank.depth + 1);
    const cam = this.cameras.main;
    this.time.delayedCall(RESPAWN_DELAY * 1000 - FADE_MS, () => cam.fadeOut(FADE_MS));
    this.time.delayedCall(RESPAWN_DELAY * 1000, () => {
      const { x, y, heading } = this.respawnPoint;
      this.tank.respawn(x, y, heading);
      this.streamer.update(x, y);
      this.elevation.prepare(this.tank);
      cam.fadeIn(FADE_MS);
    });
  }

  private debugDamage({ amount }: GameEvents['debug:damagePlayer']): void {
    this.combat.damage(this.tank, amount);
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
    this.tank.teleport(x, y, heading);
    this.streamer.update(x, y);
    this.elevation.prepare(this.tank);
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

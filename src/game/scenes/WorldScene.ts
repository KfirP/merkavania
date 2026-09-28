import Phaser from 'phaser';
import { getAsset } from '../../data/assetManifest';
import { CHUNK_H, CHUNK_PX_H, CHUNK_PX_W, CHUNK_W, TILE } from '../../logic/world/chunks';
import { ABOVE_DEPTH } from '../../logic/world/depth';
import { WorldGrid } from '../../logic/world/grid';
import { findSpawn, parseWorld, worldBounds, type TiledWorld } from '../../logic/world/world';
import { isDebug } from '../debug';
import { Tank } from '../entities/Tank';
import { events, type GameEvents } from '../events';
import { ChunkStreamer } from '../systems/ChunkStreamer';
import { ElevationSystem } from '../systems/ElevationSystem';
import { InputSystem } from '../systems/InputSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { SceneKey } from './keys';

/** Longest step fed to pawns, so a tab-switch hitch doesn't launch the tank through a wall. */
const MAX_DT = 1 / 20;
const WORLD_KEY = 'world_test';

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
  private grid!: WorldGrid;
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

    const spawn = findSpawn(world.chunks, (id) => this.cache.tilemap.get(id).data, 'start');
    if (!spawn) throw new Error(`${WORLD_KEY} has no start spawn`);
    this.tank = new Tank(this, spawn.x, spawn.y, 'mk2', -Math.PI / 2, this.projectiles);

    this.streamer = new ChunkStreamer(this, world, this.grid, (walls) => [
      this.physics.add.collider(this.tank, walls),
      this.projectiles.addWalls(walls),
    ]);
    this.streamer.update(this.tank.x, this.tank.y);

    const b = worldBounds(world.chunks);
    this.physics.world.setBounds(b.x, b.y, b.width, b.height);
    this.cameras.main
      .setBounds(b.x, b.y, b.width, b.height)
      .startFollow(this.tank, true, 0.15, 0.15);

    this.inputSystem = new InputSystem(this);

    if (this.sys.game.device.input.touch) this.scene.launch(SceneKey.TouchControls);
    if (isDebug()) {
      this.scene.launch(SceneKey.Debug);
      events.on('debug:toggleBodies', this.toggleBodies, this);
      events.on('debug:toggleElevation', this.toggleElevation, this);
      events.on('debug:teleport', this.teleport, this);
      events.on('world:chunks', this.redrawElevation, this);
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.inputSystem.destroy();
      this.streamer.destroy();
      events.off('debug:toggleBodies', this.toggleBodies, this);
      events.off('debug:toggleElevation', this.toggleElevation, this);
      events.off('debug:teleport', this.teleport, this);
      events.off('world:chunks', this.redrawElevation, this);
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
    this.tank.applyCommand(cmd, dt);
    this.elevation.constrain(this.tank, dt);
    this.projectiles.update();

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
      });
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

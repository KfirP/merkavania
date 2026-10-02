import Phaser from 'phaser';
import { scout as scoutDef } from '../../data/pawns';
import { emptyCommand, type TankCommand } from '../../logic/input/TankCommand';
import {
  board,
  deployPoint,
  deployRefusal,
  initialHatch,
  stepHatch,
  type HatchState,
} from '../../logic/pawn/hatch';
import { clampLeash, limitToLeash } from '../../logic/pawn/scoutMove';
import { TILE } from '../../logic/world/chunks';
import { findPath } from '../../logic/world/path';
import { canEnter, type CellLookup, type MoveContext } from '../../logic/world/traversal';
import type { Enemy } from '../entities/Enemy';
import type { Pickup } from '../entities/Pickup';
import { Scout } from '../entities/Scout';
import type { Switch } from '../entities/Switch';
import type { Tank } from '../entities/Tank';
import { events } from '../events';
import type { CombatSystem } from './CombatSystem';
import type { EffectsSystem } from './EffectsSystem';
import type { ElevationSystem } from './ElevationSystem';
import type { ProgressionSystem } from './ProgressionSystem';
import type { ProjectileSystem } from './ProjectileSystem';
import type { SpawnSystem } from './SpawnSystem';

/** Camera follow lerp, as WorldScene's. */
const FOLLOW_LERP = 0.15;
/** A scout recalled with no way home fades out over this long, ms. */
const FADE_MS = 250;
/** Extra seconds a recall may take beyond its route's walking time before the scout fades home. */
const RECALL_SLACK = 2;
/** Tiles searched to check the scout can walk from the tank to the hatch spot. */
const DEPLOY_SEARCH = 16;

type PlayerPawn = Tank | Scout;

/**
 * The player's pawns and the rear hatch (docs/ARCHITECTURE.md, Pawns). The tank is always there;
 * the scout exists while it's out. Only the active pawn takes input, and the camera follows it.
 * The hatch rules are in logic/pawn/hatch.ts; this creates and removes the scout, wires its
 * colliders and walks it home on a recall.
 */
export class PawnSystem {
  /** Holds the scout while it's out, so colliders made once keep working across deploys. */
  readonly scouts: Phaser.Physics.Arcade.Group;
  scout: Scout | null = null;
  private hatch: HatchState = initialHatch();
  private hatchPressed = false;
  /** Seconds left before a stalled recall gives up and fades the scout home. */
  private recallTimer = 0;
  private fading = false;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly tank: Tank,
    private readonly deps: {
      combat: CombatSystem;
      effects: EffectsSystem;
      projectiles: ProjectileSystem;
      spawner: SpawnSystem;
      elevation: ElevationSystem;
      progression: ProgressionSystem;
      onPickup: (p: Pickup) => void;
    },
  ) {
    this.scouts = scene.physics.add.group({ allowGravity: false });
    deps.combat.watch(this.scouts);
    this.addColliders();
    events.on('debug:hatch', this.pressHatch, this);
  }

  /** The pawn that takes input and that the camera and chunk streaming follow. */
  get active(): PlayerPawn {
    return this.scout ?? this.tank;
  }

  /** The player's pawns enemies may go after. */
  get players(): readonly PlayerPawn[] {
    return this.scout ? [this.tank, this.scout] : [this.tank];
  }

  /** Colliders for a chunk's walls layer (see ChunkStreamer). */
  wallColliders(walls: Phaser.Tilemaps.TilemapLayer): Phaser.Physics.Arcade.Collider[] {
    return [this.scene.physics.add.collider(this.scouts, walls)];
  }

  /** Debug hook: the same as pressing the hatch button. */
  pressHatch(): void {
    this.hatchPressed = true;
  }

  /** One frame: the hatch, then the active pawn moves; the tank holds still while the scout is out. */
  update(cmd: TankCommand, dt: number): void {
    const { tank, scout } = this;
    const hatchPressed = cmd.hatch || this.hatchPressed;
    this.hatchPressed = false;
    const refusal = this.hatch.mode === 'tank' && hatchPressed ? this.deployRefusal() : null;
    const { state, action } = stepHatch(this.hatch, {
      hatch: hatchPressed && !this.fading,
      canDeploy: refusal === null,
      tankAlive: tank.alive,
      scoutAlive: scout?.alive ?? false,
      distToTank: scout ? Phaser.Math.Distance.BetweenPoints(scout.pos, tank.pos) : 0,
      boardRadius: scoutDef.boardRadius,
      deathCooldown: scoutDef.deathCooldown,
      dt,
    });
    this.hatch = state;
    switch (action) {
      case 'deploy':
        this.deploy();
        break;
      case 'refused':
        if (refusal && refusal !== 'locked') events.emit('hatch:refused', { reason: refusal });
        break;
      case 'recall':
        this.recall();
        break;
      case 'board':
        this.removeScout();
        break;
      case 'lost':
        this.lose();
        break;
    }

    if (tank.alive) {
      tank.applyCommand(this.scout ? emptyCommand() : cmd, dt);
      this.deps.elevation.constrain(tank, dt);
    }
    if (this.scout?.alive && !this.fading) this.moveScout(this.scout, cmd, dt);
  }

  destroy(): void {
    events.off('debug:hatch', this.pressHatch, this);
  }

  private moveScout(scout: Scout, cmd: TankCommand, dt: number): void {
    const { elevation } = this.deps;
    elevation.prepare(scout);
    if (this.hatch.mode === 'recall') {
      this.recallTimer -= dt;
      if (!scout.walkRoute() || this.recallTimer <= 0) {
        this.fadeHome();
        return;
      }
    } else {
      scout.applyCommand(cmd, dt);
      const anchor = this.tank.pos;
      const far = Phaser.Math.Distance.BetweenPoints(scout.pos, anchor) > scoutDef.leash + 1;
      if (far) {
        const back = clampLeash(scout.pos, anchor, scoutDef.leash);
        scout.teleport(back.x, back.y);
      }
      const v = scout.body.velocity;
      const limited = limitToLeash(scout.pos, { vx: v.x, vy: v.y }, anchor, scoutDef.leash);
      v.set(limited.vx, limited.vy);
    }
    elevation.constrain(scout, dt);
  }

  private deployRefusal() {
    const { tank } = this;
    const spot = this.deploySpot();
    return deployRefusal({
      has: this.deps.progression.has('hatch_scout'),
      alive: tank.alive,
      speed: tank.speed,
      maxSpeed: scoutDef.deploySpeedMax,
      cooldown: this.hatch.cooldown,
      spotOk: this.spotOk(spot),
    });
  }

  private deploySpot() {
    const { tank } = this;
    return deployPoint(tank.pos, tank.heading, tank.body.radius, scoutDef.bodyRadius);
  }

  /** The scout can stand behind the tank: same level, walkable from under the tank, unobstructed. */
  private spotOk(spot: { x: number; y: number }): boolean {
    const { cellAt } = this.deps.elevation;
    const tile = { tx: Math.floor(spot.x / TILE), ty: Math.floor(spot.y / TILE) };
    const cell = cellAt(tile.tx, tile.ty);
    if (!cell || cell.level !== this.tank.level || !canEnter(null, cell, 'n', this.scoutCtx()))
      return false;
    const from = { tx: Math.floor(this.tank.pos.x / TILE), ty: Math.floor(this.tank.pos.y / TILE) };
    if (!findPath(cellAt, from, tile, this.scoutCtx(), DEPLOY_SEARCH)) return false;
    return !this.deps.spawner.blocksAt(spot.x, spot.y, scoutDef.bodyRadius, this.tank.level);
  }

  private scoutCtx(): MoveContext {
    return { pawn: 'scout', abilities: this.deps.elevation.abilities() };
  }

  private deploy(): void {
    const spot = this.deploySpot();
    const scout = new Scout(this.scene, spot.x, spot.y, this.tank.level, this.deps.projectiles);
    this.scouts.add(scout);
    scout.configureBody();
    this.deps.combat.add(scout);
    this.scout = scout;
    this.follow(scout);
    events.emit('pawn:switched', { kind: 'scout' });
    events.emit('hp:changed', { target: scout.combatId, hp: scout.hp, max: scout.maxHp });
  }

  /** Walks the scout home along the grid, around closed doors; with no route it fades home. */
  private recall(): void {
    const scout = this.scout!;
    const doors = this.deps.spawner.doorRects();
    const { cellAt } = this.deps.elevation;
    const withDoors: CellLookup = (tx, ty) => {
      const cell = cellAt(tx, ty);
      if (!cell) return null;
      const tile = new Phaser.Geom.Rectangle(tx * TILE, ty * TILE, TILE, TILE);
      const shut = doors.some((d) => Phaser.Geom.Intersects.RectangleToRectangle(d, tile));
      return shut ? { ...cell, solid: true } : cell;
    };
    const tileOf = (p: { x: number; y: number }) => ({
      tx: Math.floor(p.x / TILE),
      ty: Math.floor(p.y / TILE),
    });
    const route = findPath(withDoors, tileOf(scout.pos), tileOf(this.tank.pos), this.scoutCtx());
    if (!route) {
      this.fadeHome();
      return;
    }
    scout.followRoute(route);
    this.recallTimer = (route.length * TILE) / scoutDef.recallSpeed + RECALL_SLACK;
  }

  /** The scout can't walk home: it fades out and is back in the tank. */
  private fadeHome(): void {
    const scout = this.scout;
    if (!scout || this.fading) return;
    this.fading = true;
    scout.body.stop();
    this.scene.tweens.add({
      targets: scout,
      alpha: 0,
      duration: FADE_MS,
      onComplete: () => {
        this.fading = false;
        this.hatch = board(this.hatch);
        this.removeScout();
      },
    });
  }

  /** The scout went down (or the tank did): it's gone, and control is back with the tank. */
  private lose(): void {
    const scout = this.scout;
    if (scout && !scout.alive) {
      const { x, y } = scout.pos;
      this.deps.effects.explosion(x, y, 6, scout.depth + 1);
    }
    this.removeScout();
  }

  private removeScout(): void {
    const scout = this.scout;
    if (!scout) return;
    this.scout = null;
    this.fading = false;
    scout.destroy();
    this.follow(this.tank);
    events.emit('pawn:switched', { kind: 'tank' });
    const { tank } = this;
    events.emit('hp:changed', { target: tank.combatId, hp: tank.hp, max: tank.maxHp });
  }

  private follow(pawn: PlayerPawn): void {
    this.scene.cameras.main.startFollow(pawn, true, FOLLOW_LERP, FOLLOW_LERP);
  }

  /**
   * Bodies only meet on the same level. The scout stops against doors, destructibles, boulders and
   * enemies, takes pickups and flips scout switches by walking onto them.
   */
  private addColliders(): void {
    const { physics } = this.scene;
    const { spawner } = this.deps;
    const sameLevel = (a: unknown, b: unknown) =>
      (a as { level: number }).level === (b as { level: number }).level;
    const living = (a: unknown, b: unknown) =>
      sameLevel(a, b) && (a as Scout).alive && (b as Enemy).alive;
    for (const solid of [spawner.solids, spawner.doors, spawner.boulders])
      physics.add.collider(this.scouts, solid, undefined, sameLevel);
    physics.add.collider(this.scouts, spawner.enemies, undefined, living);
    physics.add.overlap(
      this.scouts,
      spawner.pickups,
      (_s, p) => this.deps.onPickup(p as Pickup),
      (s, p) => (s as Scout).alive && sameLevel(s, p),
    );
    physics.add.overlap(
      this.scouts,
      spawner.switches,
      (_s, sw) => (sw as Switch).touchedBy('scout'),
      (s, sw) => (s as Scout).alive && sameLevel(s, sw),
    );
  }
}

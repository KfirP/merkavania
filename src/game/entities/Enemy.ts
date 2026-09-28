import Phaser from 'phaser';
import { getAsset } from '../../data/assetManifest';
import { WAYPOINT_REACHED, type EnemyDef } from '../../data/enemies';
import type { PawnKind } from '../../data/terrain';
import { weapons, type WeaponDef } from '../../data/weapons';
import { initialBrain, stepBrain, type BrainState, type Intent } from '../../logic/enemy/brain';
import { clampToArc, steerToward } from '../../logic/enemy/steer';
import { wrapAngle, type Vec2 } from '../../logic/input/stick';
import { offsetFrom } from '../../logic/tank/geometry';
import { stepHull, withSpeedMul, type HullState, type HullStats } from '../../logic/tank/hull';
import { stepTurret } from '../../logic/tank/turret';
import { depthFor } from '../../logic/world/depth';
import { hasLineOfSight } from '../../logic/world/lineOfSight';
import type { EnemySpec } from '../../logic/world/objects';
import type { CellLookup } from '../../logic/world/traversal';
import type { ProjectileSystem } from '../systems/ProjectileSystem';
import type { Damageable, Defense } from './Damageable';

/** What an enemy needs from the world each frame. */
export interface EnemyContext {
  readonly player: { readonly pos: Vec2; readonly level: number; readonly alive: boolean };
  readonly cellAt: CellLookup;
  readonly projectiles: ProjectileSystem;
}

/** Seconds an HP bar stays up after the last hit. */
const BAR_SECONDS = 3;
const BAR_WIDTH = 16;
const LASER_COLOR = 0xff3030;

const isVehicle = (def: EnemyDef) => def.behaviour === 'raider' || def.behaviour === 'armor';

/** Vehicle handling from the enemy's top speed and turn rate. */
const hullStats = (def: EnemyDef): HullStats => ({
  maxSpeed: def.speed,
  reverseSpeed: def.speed / 2,
  accel: def.speed * 1.5,
  brake: def.speed * 3,
  drag: def.speed * 1.5,
  turnRate: def.turnRate,
});

/**
 * One enemy (a squad spawns one per soldier). The brain (logic/enemy/brain.ts) decides; this
 * carries it out: vehicles drive their hull like the player's tank, infantry walk straight to
 * where they're going, static guns only traverse. Every number comes from `data/enemies.ts`.
 */
export class Enemy extends Phaser.Physics.Arcade.Sprite implements Damageable {
  readonly faction = 'enemy';
  readonly kind: PawnKind;
  readonly maxHp: number;
  readonly weapon: WeaponDef;
  readonly turret: Phaser.GameObjects.Image | null = null;
  hp: number;
  alive = true;
  level: number;
  speedMul = 1;
  declare body: Phaser.Physics.Arcade.Body;
  private brain: BrainState = initialBrain();
  private hull: HullState;
  private aimAngle: number;
  private readonly home: Vec2;
  private laser: Phaser.GameObjects.Graphics | null = null;
  private bar: Phaser.GameObjects.Graphics | null = null;
  private barTimer = 0;
  private shownHp: number;

  constructor(
    scene: Phaser.Scene,
    readonly combatId: string,
    readonly def: EnemyDef,
    private readonly spec: EnemySpec,
    x: number,
    y: number,
    private readonly onKilled: (e: Enemy) => void,
  ) {
    super(scene, x, y, def.sprites.body);
    this.kind = isVehicle(def) || def.behaviour === 'static' ? 'tank' : 'scout';
    this.hp = this.shownHp = this.maxHp = def.hp;
    this.weapon = weapons[def.weapon];
    this.level = spec.level;
    this.home = { x, y };
    this.hull = { heading: spec.facing, speed: 0 };
    this.aimAngle = spec.facing;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setRotation(spec.facing);
    this.configureBody();

    if (def.sprites.turret) {
      const origin = getAsset(def.sprites.turret).origin ?? { x: 0.5, y: 0.5 };
      this.turret = scene.add.image(x, y, def.sprites.turret).setOrigin(origin.x, origin.y);
    }
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncAttachments, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.syncAttachments, this);
      this.turret?.destroy();
      this.laser?.destroy();
      this.bar?.destroy();
    });
  }

  /**
   * Circle body and immovability. Called again after joining a physics group, because adding a
   * body to a group resets it to the group's defaults.
   */
  configureBody(): void {
    const r = this.def.bodyRadius;
    this.body.setCircle(r, this.width / 2 - r, this.height / 2 - r);
    this.body.setCollideWorldBounds(true);
    this.body.setImmovable(this.def.behaviour === 'static');
    this.body.pushable = this.def.behaviour !== 'static';
  }

  get pos(): Vec2 {
    return this.body.center;
  }

  get defense(): Defense {
    return this.def.hasRear
      ? { armor: this.def.armor, heading: this.hull.heading }
      : { armor: this.def.armor };
  }

  get flashTargets() {
    return this.turret ? [this, this.turret] : [this];
  }

  get mode(): BrainState['mode'] {
    return this.brain.mode;
  }

  /** One frame: perceive, decide, act. Movement is constrained afterwards by ElevationSystem. */
  think(ctx: EnemyContext, dt: number): void {
    if (!this.alive) return;
    const self = this.pos;
    const player = ctx.player.alive ? ctx.player.pos : null;
    const aimTo = player ? Math.atan2(player.y - self.y, player.x - self.x) : this.aimAngle;
    const visible =
      player !== null &&
      ctx.player.level === this.level &&
      Math.hypot(player.x - self.x, player.y - self.y) <= this.def.sightRange &&
      hasLineOfSight(self, player, this.level, ctx.cellAt);

    const { state, intent } = stepBrain(
      this.brain,
      {
        self,
        home: this.home,
        target: player,
        visible,
        aimError: Math.abs(wrapAngle(aimTo - this.aimAngle)),
        patrol: this.spec.patrol,
      },
      {
        behaviour: this.def.behaviour,
        fireRange: this.def.fireRange,
        windup: this.def.windup,
        interval: this.weapon.interval,
      },
      dt,
    );
    this.brain = state;
    this.move(intent, dt);
    this.aim(intent, dt);
    if (intent.fire) this.fire(ctx.projectiles);
    this.updateOverlays(player, dt);
    this.setDepth(depthFor(this.level, self.y));
  }

  die(): void {
    if (!this.alive) return;
    this.alive = false;
    this.onKilled(this);
    this.destroy();
  }

  private move(intent: Intent, dt: number): void {
    const v = this.body.velocity;
    if (this.def.behaviour === 'static') {
      v.set(0, 0);
      return;
    }
    if (isVehicle(this.def)) {
      const { throttle, turn } = intent.moveTo
        ? steerToward(this.hull.heading, this.pos, intent.moveTo, WAYPOINT_REACHED)
        : { throttle: 0, turn: 0 };
      this.hull = stepHull(
        this.hull,
        throttle,
        turn,
        withSpeedMul(hullStats(this.def), this.speedMul),
        dt,
      );
      this.setRotation(this.hull.heading);
      this.scene.physics.velocityFromRotation(this.hull.heading, this.hull.speed, v);
      return;
    }
    // On foot: straight to the spot, facing where they aim.
    const to = intent.moveTo;
    const d = to ? Math.hypot(to.x - this.pos.x, to.y - this.pos.y) : 0;
    if (!to || d <= WAYPOINT_REACHED / 2) v.set(0, 0);
    else {
      const speed = this.def.speed * this.speedMul;
      v.set(((to.x - this.pos.x) / d) * speed, ((to.y - this.pos.y) / d) * speed);
      if (!intent.aimAt) this.aimAngle = Math.atan2(v.y, v.x);
    }
  }

  private aim(intent: Intent, dt: number): void {
    if (intent.aimAt) {
      let want = Math.atan2(intent.aimAt.y - this.pos.y, intent.aimAt.x - this.pos.x);
      if (this.def.aimArc !== undefined) want = clampToArc(want, this.spec.facing, this.def.aimArc);
      this.aimAngle = stepTurret(this.aimAngle, want, this.def.traverseRate, dt);
    }
    // Soldiers turn their whole body to aim; vehicles keep the hull and swing the turret.
    if (!isVehicle(this.def) && this.def.behaviour !== 'static') this.setRotation(this.aimAngle);
  }

  private fire(projectiles: ProjectileSystem): void {
    const { x, y } = offsetFrom(this.pos.x, this.pos.y, this.aimAngle, this.def.muzzle, 0);
    projectiles.fire(this.weapon, x, y, this.aimAngle, this.level, 'enemy');
    const flash = this.scene.add
      .image(x, y, 'muzzle_flash')
      .setOrigin(getAsset('muzzle_flash').origin?.x ?? 0, 0.5)
      .setRotation(this.aimAngle)
      .setScale(this.weapon.class === 'small_arms' ? 0.5 : 0.8)
      .setDepth(this.depth + 1);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 70,
      onComplete: () => flash.destroy(),
    });
  }

  /** The ATGM's aiming laser during its windup, and the HP bar after a hit. */
  private updateOverlays(player: Vec2 | null, dt: number): void {
    const aiming = this.def.behaviour === 'missile_team' && this.brain.mode === 'alert' && player;
    if (aiming) {
      this.laser ??= this.scene.add.graphics();
      const tip = offsetFrom(this.pos.x, this.pos.y, this.aimAngle, this.def.muzzle, 0);
      const len = Math.hypot(player.x - tip.x, player.y - tip.y);
      const end = offsetFrom(tip.x, tip.y, this.aimAngle, len, 0);
      const blink = Math.floor(this.brain.timer * 8) % 2 === 0 ? 0.9 : 0.5;
      this.laser
        .clear()
        .setDepth(this.depth + 1)
        .lineStyle(1, LASER_COLOR, blink)
        .lineBetween(tip.x, tip.y, end.x, end.y);
    } else this.laser?.clear();

    if (this.hp < this.shownHp) this.barTimer = BAR_SECONDS;
    this.shownHp = this.hp;
    this.barTimer = Math.max(0, this.barTimer - dt);
    if (this.barTimer > 0) {
      this.bar ??= this.scene.add.graphics();
      const x = Math.round(this.pos.x - BAR_WIDTH / 2);
      const y = Math.round(this.pos.y - this.displayHeight / 2 - 5);
      this.bar
        .clear()
        .setDepth(this.depth + 2)
        .setAlpha(Math.min(1, this.barTimer))
        .fillStyle(0x000000, 0.7)
        .fillRect(x - 1, y - 1, BAR_WIDTH + 2, 4)
        .fillStyle(0xd6453e)
        .fillRect(x, y, Math.ceil((BAR_WIDTH * this.hp) / this.maxHp), 2);
    } else this.bar?.clear();
  }

  /** Turret follows the hull after Arcade has moved it this frame. */
  private syncAttachments(): void {
    this.turret
      ?.setPosition(this.x, this.y)
      .setRotation(this.aimAngle)
      .setDepth(this.depth + 0.5);
  }
}

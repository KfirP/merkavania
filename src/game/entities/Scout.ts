import type Phaser from 'phaser';
import { scout as def } from '../../data/pawns';
import { weapons } from '../../data/weapons';
import type { TankCommand } from '../../logic/input/TankCommand';
import { scoutVelocity } from '../../logic/pawn/scoutMove';
import { tickCooldown, tryTrigger } from '../../logic/tank/cooldown';
import { offsetFrom } from '../../logic/tank/geometry';
import { depthFor } from '../../logic/world/depth';
import { events } from '../events';
import type { ProjectileSystem } from '../systems/ProjectileSystem';
import type { Damageable, Defense } from './Damageable';
import { Pawn } from './Pawn';

/** Waypoints closer than this count as reached, px. */
const WAYPOINT_REACH = 2;
/** The rifle muzzle sits this far ahead of the scout's centre, px. */
const MUZZLE = 6;

/**
 * The rear-hatch scout (docs/ARCHITECTURE.md, Pawns): walks 8-way, fits through `crawlspace`,
 * flips `scout` switches by walking onto them and carries a light rifle. Numbers in data/pawns.ts.
 */
export class Scout extends Pawn implements Damageable {
  readonly kind = 'scout';
  readonly combatId = 'scout';
  readonly faction = 'player';
  alive = true;
  private facing = 0;
  private rifleCooldown = 0;
  /** Recall route still to walk, tile centres. */
  private route: { x: number; y: number }[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    level: number,
    private readonly projectiles: ProjectileSystem,
  ) {
    super(scene, x, y, def.sprite, def.hp, def.bodyRadius);
    this.level = level;
    this.body.setAllowGravity(false);
    this.setDepth(depthFor(level, y));
  }

  /** Circle body again after joining a physics group, which resets it to the group's defaults. */
  configureBody(): void {
    const r = def.bodyRadius;
    this.body.setCircle(r, this.width / 2 - r, this.height / 2 - r);
    this.body.setCollideWorldBounds(true);
    this.body.setAllowGravity(false);
  }

  get aim(): number {
    return this.facing;
  }

  get defense(): Defense {
    return { armor: def.armor };
  }

  get flashTargets() {
    return [this];
  }

  applyCommand(cmd: TankCommand, dt: number): void {
    const { vx, vy } = scoutVelocity(cmd.throttle, cmd.turn, def.speed * this.speedMul);
    this.body.velocity.set(vx, vy);
    if (cmd.aimAngle !== null) this.facing = cmd.aimAngle;
    else if (vx !== 0 || vy !== 0) this.facing = Math.atan2(vy, vx);
    this.setRotation(this.facing);

    this.rifleCooldown = tickCooldown(this.rifleCooldown, dt);
    if (cmd.fire) this.fireRifle();
    this.setDepth(depthFor(this.level, this.pos.y));
  }

  /** Recall: walks the route to the tank, ignoring input. */
  followRoute(route: { x: number; y: number }[]): void {
    this.route = [...route];
  }

  /** One recall step toward the next waypoint; returns false once the route is walked. */
  walkRoute(): boolean {
    const { x, y } = this.pos;
    while (
      this.route.length &&
      Math.hypot(this.route[0]!.x - x, this.route[0]!.y - y) < WAYPOINT_REACH
    )
      this.route.shift();
    const next = this.route[0];
    if (!next) {
      this.body.velocity.set(0, 0);
      return false;
    }
    this.facing = Math.atan2(next.y - y, next.x - x);
    this.scene.physics.velocityFromRotation(
      this.facing,
      def.recallSpeed * this.speedMul,
      this.body.velocity,
    );
    this.setRotation(this.facing);
    this.setDepth(depthFor(this.level, y));
    return true;
  }

  die(): void {
    if (!this.alive) return;
    this.alive = false;
    this.body.stop();
    this.body.enable = false;
    this.setVisible(false);
    events.emit('scout:died', undefined);
  }

  private fireRifle(): void {
    const rifle = weapons[def.weapon];
    const shot = tryTrigger(this.rifleCooldown, rifle.interval);
    this.rifleCooldown = shot.remaining;
    if (!shot.fired) return;
    const { x, y } = this.pos;
    const tip = offsetFrom(x, y, this.facing, MUZZLE, 0);
    this.projectiles.fire(rifle, tip.x, tip.y, this.facing, this.level, 'player');
    events.emit('weapon:fired', { weapon: rifle.id });
  }
}

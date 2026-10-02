import Phaser from 'phaser';
import { getAsset } from '../../data/assetManifest';
import { mkTiers, type MkTier, type MkTierId } from '../../data/mkTiers';
import { secondaries, type SecondaryId } from '../../data/progression';
import { QUICK_ROUND_REFILL_SECONDS, weapons } from '../../data/weapons';
import type { TankCommand } from '../../logic/input/TankCommand';
import { tickCooldown, tryTrigger } from '../../logic/tank/cooldown';
import { offsetFrom } from '../../logic/tank/geometry';
import { speedAfterImpact, stepHull, withSpeedMul, type HullState } from '../../logic/tank/hull';
import {
  initialGun,
  tickGun,
  tryFire,
  type MainGunState,
  type MainGunStats,
} from '../../logic/tank/mainGun';
import { stepTurret } from '../../logic/tank/turret';
import { depthFor } from '../../logic/world/depth';
import { events } from '../events';
import type { MortarSystem } from '../systems/MortarSystem';
import type { ProjectileSystem } from '../systems/ProjectileSystem';
import type { Damageable, Defense } from './Damageable';
import { Pawn } from './Pawn';

/** Recoil recovery, px/s. */
const RECOIL_RECOVERY = 20;
/** Coax MG sits to the left of the main gun: distance along the barrel and to its left, px. */
const COAX_FORWARD = 12;
const COAX_SIDE = 4;

/** Which secondaries the tank carries and their ammo (ProgressionSystem, over the GameState). */
export interface Arsenal {
  selected(): SecondaryId;
  cycle(dir: 1 | -1): void;
  /** Uses a round; false when the secondary is locked or empty. */
  spend(id: SecondaryId): boolean;
}

/** The player's Merkava: hull with momentum, an independently traversing turret, main gun + coax MG. */
export class Tank extends Pawn implements Damageable {
  readonly kind = 'tank';
  readonly combatId = 'player';
  readonly faction = 'player';
  alive = true;
  readonly turret: Phaser.GameObjects.Image;
  private tier: MkTier;
  private hull: HullState;
  private turretAngle: number;
  private gun: MainGunState;
  private mgCooldown = 0;
  private mortarCooldown = 0;
  /** Last mortar range asked for (mouse distance, stick tilt); null = full range. */
  private lobDistance: number | null = null;
  private recoil = 0;
  private lastGunEvent = '';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    tierId: MkTierId,
    heading: number,
    private readonly projectiles: ProjectileSystem,
    private readonly arsenal: Arsenal,
    private readonly mortar: MortarSystem,
    /** Tier HP plus armor plates (GameState). */
    maxHp: number,
  ) {
    const tier = mkTiers[tierId];
    super(scene, x, y, tier.sprites.hull, maxHp, tier.bodyRadius);
    this.tier = tier;
    this.hull = { heading, speed: 0 };
    this.turretAngle = heading;
    this.gun = initialGun(this.gunStats);

    const origin = getAsset(tier.sprites.turret).origin ?? { x: 0.5, y: 0.5 };
    this.turret = scene.add.image(x, y, tier.sprites.turret).setOrigin(origin.x, origin.y);
    this.setRotation(heading);

    // Sync the turret after Arcade has moved the hull this frame, so it never lags a frame behind.
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncTurret, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.syncTurret, this);
      this.turret.destroy();
    });
  }

  get heading(): number {
    return this.hull.heading;
  }

  get speed(): number {
    return this.hull.speed;
  }

  get aim(): number {
    return this.turretAngle;
  }

  get defense(): Defense {
    return { armor: this.tier.armor, heading: this.hull.heading };
  }

  get flashTargets() {
    return [this, this.turret];
  }

  /** HP hit 0: the wreck disappears and stops colliding until `respawn`. */
  die(): void {
    if (!this.alive) return;
    this.alive = false;
    this.hull.speed = 0;
    this.body.stop();
    this.body.enable = false;
    this.setVisible(false);
    this.turret.setVisible(false);
    events.emit('player:died', undefined);
  }

  /** Back in action at (x, y) with full HP and a fresh gun. */
  respawn(x: number, y: number, heading: number): void {
    this.body.enable = true;
    this.teleport(x, y, heading);
    this.turretAngle = heading;
    this.hp = this.maxHp;
    this.gun = initialGun(this.gunStats);
    this.alive = true;
    this.setVisible(true);
    this.turret.setVisible(true);
    events.emit('hp:changed', { target: this.combatId, hp: this.hp, max: this.maxHp });
    events.emit('player:respawned', undefined);
  }

  /** An armor plate: max HP grows and the tank gains the same HP. */
  raiseMaxHp(max: number): void {
    const gained = max - this.maxHp;
    this.maxHp = max;
    if (this.alive) this.hp = Math.min(max, this.hp + Math.max(0, gained));
    events.emit('hp:changed', { target: this.combatId, hp: this.hp, max: this.maxHp });
  }

  /** A field repair: up to `amount` HP back. */
  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    events.emit('hp:changed', { target: this.combatId, hp: this.hp, max: this.maxHp });
  }

  /** A depot: back to full HP. */
  repair(): void {
    this.hp = this.maxHp;
    events.emit('hp:changed', { target: this.combatId, hp: this.hp, max: this.maxHp });
  }

  private get gunStats(): MainGunStats {
    return {
      quickRounds: this.tier.quickRounds,
      cooldown: this.tier.gunCooldown,
      refillPerRound: QUICK_ROUND_REFILL_SECONDS,
    };
  }

  applyCommand(cmd: TankCommand, dt: number): void {
    this.bleedMomentumOnImpact();

    const stats = withSpeedMul(this.tier.hull, this.speedMul);
    this.hull = stepHull(this.hull, cmd.throttle, cmd.turn, stats, dt);
    this.setRotation(this.hull.heading);
    this.scene.physics.velocityFromRotation(this.hull.heading, this.hull.speed, this.body.velocity);

    if (cmd.aimAngle !== null)
      this.turretAngle = stepTurret(this.turretAngle, cmd.aimAngle, this.tier.traverseRate, dt);

    this.updateWeapons(cmd, dt);
    this.setDepth(depthFor(this.level, this.pos.y));
  }

  /** Carries a wall hit into the hull speed (see `speedAfterImpact`). */
  private bleedMomentumOnImpact(): void {
    if (this.body.blocked.none && this.body.touching.none) return;
    const v = this.body.velocity;
    this.hull.speed = speedAfterImpact(this.hull.speed, this.hull.heading, v.x, v.y);
  }

  /** Cliffs and gated terrain bleed momentum the same way walls do. */
  override onBlocked(vx: number, vy: number): void {
    this.hull.speed = speedAfterImpact(this.hull.speed, this.hull.heading, vx, vy);
  }

  override teleport(x: number, y: number, heading?: number): void {
    super.teleport(x, y);
    this.hull = { heading: heading ?? this.hull.heading, speed: 0 };
    this.setRotation(this.hull.heading);
  }

  private updateWeapons(cmd: TankCommand, dt: number): void {
    const stats = this.gunStats;
    this.gun = tickGun(this.gun, stats, dt);
    this.mgCooldown = tickCooldown(this.mgCooldown, dt);
    this.mortarCooldown = tickCooldown(this.mortarCooldown, dt);
    if (cmd.cycleNext) this.arsenal.cycle(1);
    if (cmd.cyclePrev) this.arsenal.cycle(-1);
    if (cmd.aimDistance !== null) this.lobDistance = cmd.aimDistance;
    this.recoil = Math.max(0, this.recoil - RECOIL_RECOVERY * dt);

    if (cmd.fire) {
      const shot = tryFire(this.gun, stats);
      this.gun = shot.state;
      if (shot.fired) this.fireMainGun();
    }
    const secondary = cmd.altCoax ? 'coax_mg' : this.arsenal.selected();
    // The mortar sits on its own mount, so it lobs toward the aim, not where the turret points.
    if (cmd.altFire && secondary === 'mortar')
      this.fireMortar(cmd.aimAngle ?? this.turretAngle, this.lobDistance);
    if (cmd.lob) this.fireMortar(cmd.lob.angle, cmd.lob.distance);
    if (cmd.altFire && secondary === 'coax_mg') {
      const mg = weapons.coax_mg;
      const shot = tryTrigger(this.mgCooldown, mg.interval);
      this.mgCooldown = shot.remaining;
      if (shot.fired) {
        const { x, y } = this.pivot();
        const coax = offsetFrom(x, y, this.turretAngle, COAX_FORWARD, COAX_SIDE);
        this.projectiles.fire(mg, coax.x, coax.y, this.turretAngle, this.level, 'player');
        events.emit('weapon:fired', { weapon: mg.id });
      }
    }
    this.emitGunState();
  }

  private fireMortar(angle: number, distance: number | null): void {
    const weapon = weapons[secondaries.mortar.weapon];
    if (this.mortarCooldown > 0 || !this.arsenal.spend('mortar')) return;
    this.mortarCooldown = tryTrigger(this.mortarCooldown, weapon.interval).remaining;
    this.mortar.launch(weapon, this.pos, angle, distance, 'player');
  }

  private fireMainGun(): void {
    const weapon = weapons[this.tier.mainGun];
    const { x, y } = this.pivot();
    const a = this.turretAngle;
    const { x: tipX, y: tipY } = offsetFrom(x, y, a, this.tier.muzzleLength, 0);
    this.projectiles.fire(weapon, tipX, tipY, a, this.level, 'player');
    this.recoil = weapon.recoil;

    const flash = this.scene.add
      .image(tipX, tipY, 'muzzle_flash')
      .setOrigin(getAsset('muzzle_flash').origin?.x ?? 0, 0.5)
      .setRotation(a)
      .setDepth(this.turret.depth + 1);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 90,
      onComplete: () => flash.destroy(),
    });
    this.scene.cameras.main.shake(90, 0.003);
    events.emit('weapon:fired', { weapon: weapon.id });
  }

  private emitGunState(): void {
    const refillRemaining = Math.ceil(this.gun.refill * 10) / 10;
    const key = `${this.gun.rounds}|${refillRemaining}`;
    if (key === this.lastGunEvent) return;
    this.lastGunEvent = key;
    events.emit('gun:state', {
      rounds: this.gun.rounds,
      max: this.tier.quickRounds,
      refillRemaining,
    });
  }

  /** Turret ring position: offset toward the rear of the hull. */
  private pivot(): { x: number; y: number } {
    const { x, y } = this.pos;
    return offsetFrom(x, y, this.hull.heading, this.tier.turretOffset, 0);
  }

  private syncTurret(): void {
    const { x, y } = this.pivot();
    const kicked = offsetFrom(x, y, this.turretAngle, -this.recoil, 0);
    this.turret
      .setPosition(kicked.x, kicked.y)
      .setRotation(this.turretAngle)
      .setDepth(this.depth + 0.5);
  }
}

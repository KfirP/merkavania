import Phaser from 'phaser';
import type { WeaponDef } from '../../data/weapons';
import type { Owner } from '../../logic/combat/faction';
import { depthFor } from '../../logic/world/depth';

/** A pooled shell, bullet or missile. It flies until it hits something or runs out of range. */
export class Projectile extends Phaser.Physics.Arcade.Image {
  level = 0;
  owner: Owner = 'player';
  weapon!: WeaponDef;
  /** Seconds until the next smoke puff (guided missiles). */
  trailTimer = 0;
  private remaining = 0;

  launch(
    weapon: WeaponDef,
    x: number,
    y: number,
    angle: number,
    level: number,
    owner: Owner,
  ): void {
    this.weapon = weapon;
    this.owner = owner;
    this.setTexture(weapon.projectile);
    this.enableBody(true, x, y, true, true);
    // A small centred box: Arcade bodies don't rotate, so a long shell's AABB would be wrong.
    (this.body as Phaser.Physics.Arcade.Body).setSize(2, 2, true);
    this.setHeading(angle);
    this.level = level;
    this.remaining = weapon.range;
    this.setDepth(depthFor(level, y) + 1);
  }

  /** Direction of travel, radians. */
  get angleOfTravel(): number {
    return this.rotation;
  }

  /** Points the projectile (and its velocity) along `angle`. */
  setHeading(angle: number): void {
    this.setRotation(angle);
    this.scene.physics.velocityFromRotation(
      angle,
      this.weapon.speed,
      (this.body as Phaser.Physics.Arcade.Body).velocity,
    );
  }

  override update(): void {
    if (!this.active) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.remaining -= body.speed * (this.scene.game.loop.delta / 1000);
    if (this.remaining <= 0) this.expire();
  }

  /** Returns the projectile to the pool. Impacts go through ProjectileSystem.impact. */
  expire(): void {
    if (this.active) this.disableBody(true, true);
  }
}

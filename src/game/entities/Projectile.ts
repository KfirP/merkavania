import Phaser from 'phaser';
import type { WeaponDef } from '../../data/weapons';
import { depthFor } from '../../logic/world/depth';

/** A pooled shell or bullet. It flies straight until it hits a wall or runs out of range. */
export class Projectile extends Phaser.Physics.Arcade.Image {
  level = 0;
  private remaining = 0;

  launch(weapon: WeaponDef, x: number, y: number, angle: number, level: number): void {
    this.setTexture(weapon.projectile);
    this.enableBody(true, x, y, true, true);
    this.setRotation(angle);
    // A small centred box: Arcade bodies don't rotate, so a long shell's AABB would be wrong.
    (this.body as Phaser.Physics.Arcade.Body).setSize(2, 2, true);
    this.scene.physics.velocityFromRotation(
      angle,
      weapon.speed,
      (this.body as Phaser.Physics.Arcade.Body).velocity,
    );
    this.level = level;
    this.remaining = weapon.range;
    this.setDepth(depthFor(level, y) + 1);
  }

  override update(): void {
    if (!this.active) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.remaining -= body.speed * (this.scene.game.loop.delta / 1000);
    if (this.remaining <= 0) this.expire(false);
  }

  /** Removes the projectile, with an impact puff if it hit something. */
  expire(hit: boolean): void {
    if (!this.active) return;
    if (hit) spawnPuff(this.scene, this.x, this.y, this.depth);
    this.disableBody(true, true);
  }
}

function spawnPuff(scene: Phaser.Scene, x: number, y: number, depth: number): void {
  const puff = scene.add.image(x, y, 'impact_puff').setDepth(depth).setScale(0.5);
  scene.tweens.add({
    targets: puff,
    scale: 1.2,
    alpha: 0,
    duration: 220,
    onComplete: () => puff.destroy(),
  });
}

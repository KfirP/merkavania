import Phaser from 'phaser';
import { HIT_FLASH_MS, SHAKE } from '../../data/combat';
import { explosionShake, hitShake } from '../../logic/combat/shake';

/** Explosion sprite diameter, px; blasts scale it to their splash radius. */
const EXPLOSION_SIZE = 32;

/** Short-lived visual feedback: impacts, explosions, ricochets, hit flashes and camera shake. */
export class EffectsSystem {
  constructor(private readonly scene: Phaser.Scene) {}

  /** Dust puff where a shot hits something soft or a wall. */
  puff(x: number, y: number, depth: number, scale = 1): void {
    const puff = this.scene.add
      .image(x, y, 'impact_puff')
      .setDepth(depth)
      .setScale(0.5 * scale);
    this.scene.tweens.add({
      targets: puff,
      scale: 1.2 * scale,
      alpha: 0,
      duration: 220,
      onComplete: () => puff.destroy(),
    });
  }

  /** A few sparks flying back from armor that shrugged the hit off. */
  ricochet(x: number, y: number, depth: number, shotAngle: number): void {
    for (let i = 0; i < 3; i++) {
      const a = shotAngle + Math.PI + Phaser.Math.FloatBetween(-0.9, 0.9);
      const d = Phaser.Math.Between(4, 10);
      const spark = this.scene.add.image(x, y, 'spark').setDepth(depth);
      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        alpha: 0,
        duration: 140,
        onComplete: () => spark.destroy(),
      });
    }
  }

  /** A fireball sized to `radius` px, plus smoke and a shake if it's near the camera. */
  explosion(x: number, y: number, radius: number, depth: number): void {
    const scale = (radius * 2) / EXPLOSION_SIZE;
    const blast = this.scene.add
      .image(x, y, 'explosion')
      .setDepth(depth)
      .setScale(scale * 0.3)
      .setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
    this.scene.tweens.add({
      targets: blast,
      scale,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.easeOut',
      onComplete: () => blast.destroy(),
    });
    for (let i = 0; i < 3; i++)
      this.puff(
        x + Phaser.Math.Between(-radius / 2, radius / 2),
        y + Phaser.Math.Between(-radius / 2, radius / 2),
        depth,
        scale,
      );
    const cam = this.scene.cameras.main;
    const dist = Phaser.Math.Distance.Between(x, y, cam.midPoint.x, cam.midPoint.y);
    const intensity = explosionShake(dist, radius / 14);
    if (intensity > 0) cam.shake(SHAKE.explosionMs, intensity);
  }

  /** Flashes sprites white for a moment. */
  flash(targets: readonly Phaser.GameObjects.Components.Tint[]): void {
    for (const t of targets) t.setTintFill(0xffffff);
    this.scene.time.delayedCall(HIT_FLASH_MS, () => {
      for (const t of targets) t.clearTint();
    });
  }

  /** The player took `damage`. */
  playerHit(damage: number): void {
    const intensity = hitShake(damage);
    if (intensity > 0) this.scene.cameras.main.shake(SHAKE.hitMs, intensity);
  }
}

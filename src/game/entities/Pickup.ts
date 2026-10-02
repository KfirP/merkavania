import Phaser from 'phaser';
import { depthFor } from '../../logic/world/depth';
import type { PickupSpec } from '../../logic/world/objects';

/** A crate holding an ability or minor upgrade (`pickup` object); taken by driving over it. */
export class Pickup extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.StaticBody;

  constructor(
    scene: Phaser.Scene,
    readonly spec: PickupSpec,
    readonly level: number,
  ) {
    super(scene, spec.x, spec.y, 'pickup');
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setDepth(depthFor(level, spec.y));
    // Bob the sprite only; the static body stays put.
    scene.tweens.add({
      targets: this,
      displayOriginY: this.displayOriginY + 2,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}

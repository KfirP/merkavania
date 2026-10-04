import Phaser from 'phaser';
import type { MkTierId } from '../../data/mkTiers';
import { depthFor } from '../../logic/world/depth';

/**
 * The crate a beaten boss leaves (`mk_upgrade`): driving the tank onto it upgrades it to `tier`.
 * It comes back with its chunk until the tank has that tier, so it can't be lost.
 */
export class MkUpgrade extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.StaticBody;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly tier: MkTierId,
    readonly level: number,
    /** Radio message played when it's taken. */
    readonly radioKey: string,
  ) {
    super(scene, x, y, 'mk_upgrade');
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setDepth(depthFor(level, y));
    scene.tweens.add({
      targets: this,
      scale: 1.15,
      duration: 450,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}

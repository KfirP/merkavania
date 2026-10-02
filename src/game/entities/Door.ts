import Phaser from 'phaser';
import { depthFor } from '../../logic/world/depth';
import type { DoorSpec } from '../../logic/world/objects';

/** A blast door (`door` object): blocks movement and fire on its level until its switch flips. */
export class Door extends Phaser.GameObjects.TileSprite {
  declare body: Phaser.Physics.Arcade.StaticBody;

  constructor(
    scene: Phaser.Scene,
    readonly spec: DoorSpec,
    readonly level: number,
  ) {
    super(scene, spec.x, spec.y, spec.width, spec.height, 'door');
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setDepth(depthFor(level, spec.y + spec.height / 2));
  }

  /** Slides the door into the ground and removes it. */
  open(): void {
    this.body.enable = false;
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleY: 0.1,
      duration: 300,
      onComplete: () => this.destroy(),
    });
  }
}

import Phaser from 'phaser';
import { depthFor } from '../../logic/world/depth';
import type { RectSpec } from '../../logic/world/objects';

/** A repair depot pad (`depot` object): drive onto it to heal, rearm and save. */
export class Depot extends Phaser.GameObjects.Image {
  constructor(
    scene: Phaser.Scene,
    readonly spec: RectSpec,
    readonly level: number,
  ) {
    super(scene, spec.x, spec.y, 'depot_pad');
    scene.add.existing(this);
    this.setDisplaySize(spec.width, spec.height);
    // Flat on the ground: under everything else on its level.
    this.setDepth(depthFor(level, spec.y - spec.height));
  }

  contains(x: number, y: number): boolean {
    const { spec } = this;
    return Math.abs(x - spec.x) <= spec.width / 2 && Math.abs(y - spec.y) <= spec.height / 2;
  }
}

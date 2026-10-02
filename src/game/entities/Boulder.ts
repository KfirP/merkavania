import Phaser from 'phaser';
import { depthFor } from '../../logic/world/depth';
import type { BoulderSpec } from '../../logic/world/objects';
import type { Mover } from '../systems/ElevationSystem';

const RADIUS = 7;
/** Slows a shoved boulder to a stop, px/s². */
const DRAG = 600;

/**
 * A `boulder` object: an immovable rock, until the tank has the dozer blade and shoves it. Driven
 * by the same elevation rules as a vehicle, so it never drops off a cliff or into rubble.
 */
export class Boulder extends Phaser.Physics.Arcade.Image implements Mover {
  readonly kind = 'tank';
  level: number;
  speedMul = 1;
  declare body: Phaser.Physics.Arcade.Body;

  constructor(
    scene: Phaser.Scene,
    readonly spec: BoulderSpec,
    level: number,
  ) {
    super(scene, spec.x, spec.y, 'boulder');
    this.level = level;
    scene.add.existing(this);
    scene.physics.add.existing(this);
  }

  /** Call after adding it to a physics group, which resets body settings to the group defaults. */
  configureBody(shovable: boolean): void {
    this.body.setCircle(RADIUS, this.width / 2 - RADIUS, this.height / 2 - RADIUS);
    this.body.setDrag(DRAG, DRAG).setCollideWorldBounds(true);
    this.setShovable(shovable);
  }

  get pos(): { x: number; y: number } {
    return this.body.center;
  }

  /** Only a dozer blade moves it. */
  setShovable(pushable: boolean): void {
    this.body.pushable = pushable;
    this.body.immovable = !pushable;
  }

  syncDepth(): void {
    this.setDepth(depthFor(this.level, this.pos.y));
  }
}

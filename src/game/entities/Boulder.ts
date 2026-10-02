import Phaser from 'phaser';
import { depthFor } from '../../logic/world/depth';
import type { BoulderSpec } from '../../logic/world/objects';
import type { Mover } from '../systems/ElevationSystem';

const RADIUS = 7;
/** Slows a shoved boulder to a stop, px/s². */
const DRAG = 600;
/** A shoved boulder moves a little faster than the blade, so it stays just ahead of it. */
const SHOVE = 1.1;

/**
 * A `boulder` object: a rock nothing can push, except a tank with the dozer blade (`shove`). Driven
 * by the same elevation rules as a vehicle, so it never drops off a cliff or into rubble; jammed
 * against one, it blocks the blade like any rock.
 */
export class Boulder extends Phaser.Physics.Arcade.Image implements Mover {
  readonly kind = 'tank';
  level: number;
  speedMul = 1;
  /** Blocked by a wall, cliff or gate this step; a jammed boulder can't be shoved. */
  stuck = false;
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
  configureBody(): void {
    this.body.setCircle(RADIUS, this.width / 2 - RADIUS, this.height / 2 - RADIUS);
    this.body.setDrag(DRAG, DRAG).setCollideWorldBounds(true);
    // Collisions never move it: other bodies are separated from it, and only `shove` sets it going.
    // Arcade's circle separation goes by `pushable`, the rest by `immovable`, so set both.
    this.body.setImmovable(true);
    this.body.pushable = false;
  }

  get pos(): { x: number; y: number } {
    return this.body.center;
  }

  onBlocked(): void {
    this.stuck = true;
  }

  /**
   * It ran into something solid that physics won't separate it from (an immovable body meeting a
   * static one): back to where it was last step, stopped and jammed.
   */
  jam(): void {
    this.stuck = true;
    this.body.velocity.set(0, 0);
    this.body.position.copy(this.body.prev);
    this.body.updateCenter();
  }

  /**
   * A dozer blade at `from` moving at `velocity` pushes the boulder ahead of it. Returns false
   * when it's jammed, so the blade should stop against it instead.
   */
  shove(from: { x: number; y: number }, velocity: { x: number; y: number }): boolean {
    if (this.stuck) return false;
    const dx = this.pos.x - from.x;
    const dy = this.pos.y - from.y;
    const d = Math.hypot(dx, dy) || 1;
    const along = (velocity.x * dx + velocity.y * dy) / d;
    if (along > 0) this.body.velocity.set((dx / d) * along * SHOVE, (dy / d) * along * SHOVE);
    return true;
  }

  syncDepth(): void {
    this.setDepth(depthFor(this.level, this.pos.y));
  }
}

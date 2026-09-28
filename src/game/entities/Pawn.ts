import Phaser from 'phaser';
import type { TankCommand } from '../../logic/input/TankCommand';
import type { AssetKey } from '../../data/assetManifest';
import type { PawnKind } from '../../data/terrain';

/** Anything the player can drive: the tank now, the scout and drone later (ARCHITECTURE.md, Pawns). */
export abstract class Pawn extends Phaser.Physics.Arcade.Sprite {
  abstract readonly kind: PawnKind;
  level = 0;
  /** Top-speed multiplier of the terrain under the pawn (set by ElevationSystem). */
  speedMul = 1;
  hp: number;
  declare body: Phaser.Physics.Arcade.Body;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: AssetKey,
    maxHp: number,
    bodyRadius: number,
  ) {
    super(scene, x, y, texture);
    this.hp = maxHp;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    // Circle body: the hull's rotation is visual only, so there are no rotated-AABB problems.
    this.body.setCircle(bodyRadius, this.width / 2 - bodyRadius, this.height / 2 - bodyRadius);
    this.body.setCollideWorldBounds(true);
  }

  abstract applyCommand(cmd: TankCommand, dt: number): void;

  /**
   * The world stopped part of this step's motion (a cliff, gated terrain…); `vx`/`vy` is the
   * velocity that survived, with blocked axes zeroed.
   */
  onBlocked?(vx: number, vy: number): void;

  /** Debug: moves the pawn and stops it. */
  teleport(x: number, y: number): void {
    this.body.reset(x, y);
  }
}

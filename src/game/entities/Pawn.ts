import Phaser from 'phaser';
import type { TankCommand } from '../../logic/input/TankCommand';
import type { AssetKey } from '../../data/assetManifest';

/** Anything the player can drive: the tank now, the scout and drone later (ARCHITECTURE.md, Pawns). */
export abstract class Pawn extends Phaser.Physics.Arcade.Sprite {
  level = 0;
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
}

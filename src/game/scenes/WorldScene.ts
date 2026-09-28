import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../logic/scale';
import { SceneKey } from './keys';

const TILE = 16;

/** Gameplay scene. For now: a 16px grid and a placeholder tank-sized rectangle. */
export class WorldScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.World);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0xd8c18f);
    this.add
      .grid(0, 0, GAME_WIDTH, GAME_HEIGHT + TILE, TILE, TILE)
      .setOrigin(0)
      .setOutlineStyle(0xb89f6a, 0.6);

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.add.rectangle(cx, cy, 32, 24, 0x6b6b3a).setStrokeStyle(1, 0x2b2b16);
    // Turret with barrel, facing east (sprite convention).
    this.add.rectangle(cx - 2, cy, 14, 12, 0x7d7d45).setStrokeStyle(1, 0x2b2b16);
    this.add.rectangle(cx + 12, cy, 16, 2, 0x2b2b16);
  }
}

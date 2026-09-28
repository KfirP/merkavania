import Phaser from 'phaser';
import { SceneKey } from './keys';

/** Loads the minimal assets needed to draw the loading screen. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Boot);
  }

  create(): void {
    this.scene.start(SceneKey.Preload);
  }
}

import Phaser from 'phaser';
import { getAsset } from '../../data/assetManifest';
import { UI_FONT } from '../ui/text';
import { SceneKey } from './keys';

/** Loads the minimal assets needed to draw the loading screen: the UI font. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Boot);
  }

  preload(): void {
    this.load.font(UI_FONT, getAsset(UI_FONT).path, 'truetype');
  }

  create(): void {
    this.scene.start(SceneKey.Preload);
  }
}

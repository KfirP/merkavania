import Phaser from 'phaser';
import { assetManifest, type AssetEntry } from '../../data/assetManifest';
import { GAME_HEIGHT, GAME_WIDTH } from '../../logic/scale';
import { t } from '../../i18n/i18n';
import { generatePlaceholder } from '../placeholders';
import {
  queueTiledMap,
  queueTiledWorld,
  registerTiledMap,
  registerTiledWorld,
} from '../tiledLoader';
import { textStyle } from '../ui/text';
import { SceneKey } from './keys';

const BAR_WIDTH = 200;
const BAR_HEIGHT = 8;

const isTiledMap = (path: string) => path.endsWith('.tmj');
const isTiledWorld = (path: string) => path.endsWith('.world');

/** Loads everything in the asset manifest while drawing a progress bar. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Preload);
  }

  preload(): void {
    const x = (GAME_WIDTH - BAR_WIDTH) / 2;
    const y = GAME_HEIGHT / 2;
    this.add.text(GAME_WIDTH / 2, y - 12, t('boot.loading'), textStyle()).setOrigin(0.5);
    this.add.rectangle(x, y, BAR_WIDTH, BAR_HEIGHT).setOrigin(0).setStrokeStyle(1, 0xffffff);
    const fill = this.add.rectangle(x + 1, y + 1, 0, BAR_HEIGHT - 2, 0xc2b280).setOrigin(0);
    this.load.on('progress', (p: number) => (fill.width = (BAR_WIDTH - 2) * p));

    for (const asset of assetManifest as readonly AssetEntry[]) {
      if (asset.path === '' || asset.type === 'font') continue; // drawn in code, or loaded by Boot
      if (asset.type === 'image') this.load.image(asset.key, asset.path);
      else if (asset.type === 'spritesheet' && asset.frame)
        this.load.spritesheet(asset.key, asset.path, {
          frameWidth: asset.frame.width,
          frameHeight: asset.frame.height,
        });
      else if (asset.type === 'audio') this.load.audio(asset.key, asset.path);
      else if (asset.type === 'json') {
        if (isTiledMap(asset.path)) queueTiledMap(this.load, asset.key, asset.path);
        else if (isTiledWorld(asset.path)) queueTiledWorld(this.load, asset.key, asset.path);
        else this.load.json(asset.key, asset.path);
      }
    }
  }

  create(): void {
    for (const asset of assetManifest) {
      if (asset.path === '' && !generatePlaceholder(this, asset.key))
        console.warn(`No file or placeholder drawer for asset "${asset.key}"`);
      if (asset.type !== 'json') continue;
      if (isTiledMap(asset.path)) registerTiledMap(this, asset.key, asset.path);
      else if (isTiledWorld(asset.path)) registerTiledWorld(this, asset.key, asset.path);
    }
    this.scene.start(SceneKey.Title);
  }
}

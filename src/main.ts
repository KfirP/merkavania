import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './logic/scale';
import { installDebugHooks } from './game/debug';
import { installIntegerScaling } from './game/scale';
import { BootScene } from './game/scenes/BootScene';
import { PreloadScene } from './game/scenes/PreloadScene';
import { TitleScene } from './game/scenes/TitleScene';
import { WorldScene } from './game/scenes/WorldScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#000000',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.NONE },
  input: { gamepad: true },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [BootScene, PreloadScene, TitleScene, WorldScene],
});

installIntegerScaling(game);
installDebugHooks(game);

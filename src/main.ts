import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './logic/scale';
import { installDebugHooks } from './game/debug';
import { installIntegerScaling } from './game/scale';
import { applySettings } from './game/settings';
import { BootScene } from './game/scenes/BootScene';
import { DebugScene } from './game/scenes/DebugScene';
import { HudScene } from './game/scenes/HudScene';
import { PreloadScene } from './game/scenes/PreloadScene';
import { SettingsScene } from './game/scenes/SettingsScene';
import { TitleScene } from './game/scenes/TitleScene';
import { TouchControlsScene } from './game/scenes/TouchControlsScene';
import { WorldScene } from './game/scenes/WorldScene';

applySettings();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#000000',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.NONE },
  // Two thumbs plus the alt button.
  input: { gamepad: true, activePointers: 3 },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [
    BootScene,
    PreloadScene,
    TitleScene,
    WorldScene,
    HudScene,
    TouchControlsScene,
    SettingsScene,
    DebugScene,
  ],
});

installIntegerScaling(game);
installDebugHooks(game);

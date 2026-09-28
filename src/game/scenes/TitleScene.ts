import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../logic/scale';
import { isRtl, t } from '../../i18n/i18n';
import { SceneKey } from './keys';

/** Placeholder title screen; slot select, language and settings arrive in M6. */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Title);
  }

  create(): void {
    const rtl = isRtl();
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, t('title.name'), {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#c2b280',
        rtl,
      })
      .setOrigin(0.5);
    const prompt = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, t('title.press_start'), {
        fontFamily: 'monospace',
        fontSize: '8px',
        rtl,
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });

    const start = () => this.scene.start(SceneKey.World);
    this.input.keyboard?.once('keydown', start);
    this.input.once('pointerdown', start);
  }
}

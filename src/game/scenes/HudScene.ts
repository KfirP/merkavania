import Phaser from 'phaser';
import { GAME_HEIGHT } from '../../logic/scale';
import { events, type GameEvents } from '../events';
import { SceneKey } from './keys';

const BAR = { x: 4, width: 60, height: 4 };
const HP_COLOR = 0x6fbf4a;
const HP_LOW_COLOR = 0xd6453e;
/** Below this share of max HP the bar turns red. */
const LOW_HP = 0.3;

/**
 * Runs on top of WorldScene. For now just the tank's HP bar (bottom left); M6 grows it into the
 * full HUD. Driven only by `hp:changed`, never by reaching into WorldScene.
 */
export class HudScene extends Phaser.Scene {
  private fill!: Phaser.GameObjects.Rectangle;

  constructor() {
    super(SceneKey.Hud);
  }

  create(): void {
    const y = GAME_HEIGHT - BAR.height - 4;
    this.add
      .rectangle(BAR.x - 1, y - 1, BAR.width + 2, BAR.height + 2, 0x000000, 0.6)
      .setOrigin(0)
      .setStrokeStyle(1, 0x1f1f10);
    this.fill = this.add.rectangle(BAR.x, y, BAR.width, BAR.height, HP_COLOR).setOrigin(0);

    events.on('hp:changed', this.onHp, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      events.off('hp:changed', this.onHp, this),
    );
  }

  private onHp({ target, hp, max }: GameEvents['hp:changed']): void {
    if (target !== 'player') return;
    const share = Phaser.Math.Clamp(hp / max, 0, 1);
    this.fill.width = Math.ceil(BAR.width * share);
    this.fill.fillColor = share < LOW_HP ? HP_LOW_COLOR : HP_COLOR;
  }
}

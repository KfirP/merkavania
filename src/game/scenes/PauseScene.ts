import Phaser from 'phaser';
import { onLanguageChange, t } from '../../i18n/i18n';
import { GAME_HEIGHT, GAME_WIDTH } from '../../logic/scale';
import type { MenuEvent } from '../../logic/ui/menu';
import { Menu } from '../ui/Menu';
import { MenuInputReader } from '../ui/MenuInput';
import { textStyle, UI_ACCENT } from '../ui/text';
import { SceneKey } from './keys';

/**
 * Pause overlay over the paused WorldScene: Resume, Settings, Quit to title. Back (Esc, B, Start)
 * resumes. Quitting drops anything since the last depot or pickup, as dying does.
 */
export class PauseScene extends Phaser.Scene {
  private menu!: Menu;
  private input$!: MenuInputReader;

  constructor() {
    super(SceneKey.Pause);
  }

  create(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive();
    const title = this.add
      .text(GAME_WIDTH / 2, 70, '', textStyle(2, { color: UI_ACCENT }))
      .setOrigin(0.5, 0);
    this.input$ = new MenuInputReader(this);
    this.menu = new Menu(
      this,
      () => {
        title.setText(t('pause.title'));
        return [
          { item: { kind: 'action', id: 'resume' }, label: t('pause.resume') },
          { item: { kind: 'action', id: 'settings' }, label: t('title.settings') },
          { item: { kind: 'action', id: 'quit' }, label: t('pause.quit') },
        ];
      },
      { x: GAME_WIDTH / 2, y: 110, onEvent: (e) => this.onMenu(e) },
    );
    // Settings may change the language while this sits paused under it.
    const off = onLanguageChange(() => this.menu.refresh());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  override update(): void {
    for (const input of this.input$.poll().inputs) this.menu.handle(input);
  }

  private onMenu(e: MenuEvent): void {
    if (e.type === 'back' || (e.type === 'activate' && e.id === 'resume')) {
      this.scene.stop();
      this.scene.resume(SceneKey.World);
    } else if (e.type === 'activate' && e.id === 'settings') {
      this.scene.launch(SceneKey.Settings, { from: SceneKey.Pause });
      this.scene.pause();
    } else if (e.type === 'activate' && e.id === 'quit') {
      this.scene.stop(SceneKey.World);
      this.scene.start(SceneKey.Title);
    }
  }
}

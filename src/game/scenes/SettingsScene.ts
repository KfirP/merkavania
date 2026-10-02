import Phaser from 'phaser';
import { onLanguageChange, t, type I18nKey } from '../../i18n/i18n';
import {
  bindableActions,
  defaultKeybinds,
  keyNameFromEvent,
  PAUSE_KEY,
  rebind,
  type BindableAction,
} from '../../logic/input/keybinds';
import { GAME_HEIGHT, GAME_WIDTH } from '../../logic/scale';
import {
  languages,
  touchModes,
  volumeChannels,
  type VolumeChannel,
} from '../../logic/settings/settings';
import { formatPercent } from '../../logic/ui/format';
import type { MenuEvent } from '../../logic/ui/menu';
import { settings, updateSettings } from '../settings';
import { Menu, type MenuEntry } from '../ui/Menu';
import { MenuInputReader } from '../ui/MenuInput';
import { FONT_PX, textStyle, UI_ACCENT } from '../ui/text';
import { SceneKey } from './keys';

const VOLUME_STEP = 0.1;
const ROW = FONT_PX * 2;

type Mode = 'main' | 'controls';

/**
 * Settings overlay, opened from the title or the pause menu (it pauses the scene that opened it
 * and resumes it on Back): language, touch controls, volumes and keyboard bindings. Every change
 * is saved at once (`updateSettings`). Rebinding: confirm on an action, then press the new key;
 * Esc cancels. It becomes the action's main key and is taken from any other action.
 */
export class SettingsScene extends Phaser.Scene {
  private menu!: Menu;
  private input$!: MenuInputReader;
  private header!: Phaser.GameObjects.Text;
  private mode: Mode = 'main';
  /** The action waiting for a key, while capturing. */
  private capturing: BindableAction | null = null;
  private from: string = SceneKey.Title;

  constructor() {
    super(SceneKey.Settings);
  }

  create(data: { from?: string; mode?: Mode; focus?: string } = {}): void {
    this.from = data.from ?? SceneKey.Title;
    this.mode = data.mode ?? 'main';
    this.capturing = null;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.94).setOrigin(0).setInteractive();
    this.header = this.add
      .text(
        GAME_WIDTH / 2,
        12,
        '',
        textStyle(1, { color: UI_ACCENT, align: 'center', wordWrap: { width: GAME_WIDTH - 32 } }),
      )
      .setOrigin(0.5, 0);
    this.input$ = new MenuInputReader(this);
    this.menu = new Menu(this, () => this.entries(), {
      x: GAME_WIDTH / 2,
      y: 44,
      lineHeight: ROW,
      onEvent: (e) => this.onMenu(e),
    });
    if (data.focus) this.menu.focusOn(data.focus);

    const off = onLanguageChange(() =>
      this.scene.restart({ from: this.from, mode: this.mode, focus: this.menu.focusedId }),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  override update(): void {
    const { inputs, codes } = this.input$.poll();
    if (this.capturing) {
      for (const code of codes) if (this.capture(code)) break;
      return;
    }
    for (const input of inputs) this.menu.handle(input);
  }

  private entries(): MenuEntry[] {
    const s = settings();
    const choice = (name: string, value: string) => t('ui.choice', { name, value });
    if (this.mode === 'controls') {
      this.header.setText(
        this.capturing
          ? t('settings.press_key', { action: t(`controls.${this.capturing}` as I18nKey) })
          : t('settings.controls'),
      );
      return [
        ...bindableActions.map((a): MenuEntry => ({
          item: {
            kind: 'action',
            id: a,
            disabled: this.capturing !== null && this.capturing !== a,
          },
          label: t('settings.binding', {
            action: t(`controls.${a}` as I18nKey),
            keys: s.keybinds[a].length > 0 ? s.keybinds[a].join(' / ') : '-',
          }),
        })),
        {
          item: { kind: 'action', id: 'reset', disabled: this.capturing !== null },
          label: t('settings.reset_keys'),
        },
        {
          item: { kind: 'action', id: 'back', disabled: this.capturing !== null },
          label: t('ui.back'),
        },
      ];
    }
    this.header.setText(t('settings.title'));
    return [
      {
        item: {
          kind: 'choice',
          id: 'language',
          options: languages,
          value: languages.indexOf(s.language),
        },
        label: choice(t('settings.language'), t(`language.${s.language}`)),
      },
      {
        item: {
          kind: 'choice',
          id: 'touch',
          options: touchModes,
          value: touchModes.indexOf(s.touchControls),
        },
        label: choice(t('settings.touch'), t(`settings.touch_${s.touchControls}`)),
      },
      ...volumeChannels.map((ch): MenuEntry => ({
        item: { kind: 'slider', id: `volume_${ch}`, value: s.volume[ch], step: VOLUME_STEP },
        label: choice(t(`settings.volume_${ch}`), formatPercent(s.volume[ch])),
      })),
      { item: { kind: 'action', id: 'controls' }, label: t('settings.controls') },
      { item: { kind: 'action', id: 'back' }, label: t('ui.back') },
    ];
  }

  private onMenu(e: MenuEvent): void {
    if (e.type === 'back' || (e.type === 'activate' && e.id === 'back')) {
      if (this.mode === 'controls') this.setMode('main', 'controls');
      else this.close();
      return;
    }
    if (e.type === 'change') {
      if (e.id === 'language') updateSettings((s) => (s.language = languages[e.value]!));
      else if (e.id === 'touch') updateSettings((s) => (s.touchControls = touchModes[e.value]!));
      else if (e.id.startsWith('volume_')) {
        const ch = e.id.slice('volume_'.length) as VolumeChannel;
        updateSettings((s) => (s.volume[ch] = e.value));
      }
      this.menu.refresh();
      return;
    }
    if (e.type !== 'activate') return;
    if (e.id === 'controls') this.setMode('controls');
    else if (e.id === 'reset') {
      updateSettings((s) => (s.keybinds = defaultKeybinds()));
      this.menu.refresh();
    } else if ((bindableActions as readonly string[]).includes(e.id)) {
      this.capturing = e.id as BindableAction;
      this.menu.refresh();
    }
  }

  /** A key pressed while capturing; true once capture is over. */
  private capture(code: string): boolean {
    const action = this.capturing!;
    const key = keyNameFromEvent(code);
    if (key === null) return false;
    if (key !== PAUSE_KEY) updateSettings((s) => (s.keybinds = rebind(s.keybinds, action, 0, key)));
    this.capturing = null;
    this.menu.refresh();
    this.menu.focusOn(action);
    return true;
  }

  private setMode(mode: Mode, focus?: string): void {
    this.mode = mode;
    this.menu.refresh();
    if (focus) this.menu.focusOn(focus);
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume(this.from);
  }
}

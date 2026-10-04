import Phaser from 'phaser';
import { onLanguageChange, t } from '../../i18n/i18n';
import { SaveStore, SLOTS } from '../../logic/save/save';
import { GAME_WIDTH } from '../../logic/scale';
import { languages } from '../../logic/settings/settings';
import { formatDate, formatPlaytime } from '../../logic/ui/format';
import type { MenuEvent } from '../../logic/ui/menu';
import { settings, updateSettings } from '../settings';
import { browserStorage } from '../storage';
import { slotFromUrl } from '../systems/ProgressionSystem';
import { Menu, type MenuEntry } from '../ui/Menu';
import { MenuInputReader } from '../ui/MenuInput';
import { textStyle, UI_ACCENT } from '../ui/text';
import { SceneKey } from './keys';

/** Main menu, picking a save to delete, or confirming the delete. */
type Mode = { kind: 'main' } | { kind: 'delete' } | { kind: 'confirm'; slot: number };

const MENU_Y = 96;

/**
 * Title screen: the three save slots (continue or new game), settings, language and deleting a
 * save. Enter on the focused slot starts it; the slot from `?slot=N` (or slot 1) has focus first.
 */
export class TitleScene extends Phaser.Scene {
  private menu!: Menu;
  private input$!: MenuInputReader;
  private prompt!: Phaser.GameObjects.Text;
  private mode: Mode = { kind: 'main' };
  private readonly store = new SaveStore(browserStorage());

  constructor() {
    super(SceneKey.Title);
  }

  create(data: { focus?: string } = {}): void {
    this.mode = { kind: 'main' };
    this.add
      .text(GAME_WIDTH / 2, 40, t('title.name'), textStyle(3, { color: UI_ACCENT }))
      .setOrigin(0.5);
    this.prompt = this.add.text(GAME_WIDTH / 2, MENU_Y - 20, '', textStyle()).setOrigin(0.5, 0);
    this.input$ = new MenuInputReader(this);
    this.menu = new Menu(this, () => this.entries(), {
      x: GAME_WIDTH / 2,
      y: MENU_Y,
      onEvent: (e) => this.onMenu(e),
    });
    this.menu.focusOn(data.focus ?? `slot_${slotFromUrl()}`);

    // A new language changes the text direction too: rebuild the whole screen (once Settings,
    // if that's where it was changed, has closed).
    let stale = false;
    const rebuild = () => this.scene.restart({ focus: this.menu.focusedId });
    const off = onLanguageChange(() => (this.scene.isPaused() ? (stale = true) : rebuild()));
    this.events.on(Phaser.Scenes.Events.RESUME, () => stale && rebuild());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off();
      this.events.off(Phaser.Scenes.Events.RESUME);
    });
  }

  override update(): void {
    for (const input of this.input$.poll().inputs) this.menu.handle(input);
  }

  private entries(): MenuEntry[] {
    const mode = this.mode;
    this.prompt.setText(
      mode.kind === 'delete'
        ? t('title.delete_pick')
        : mode.kind === 'confirm'
          ? t('title.delete_confirm', { n: mode.slot })
          : '',
    );
    if (mode.kind === 'confirm')
      return [
        { item: { kind: 'action', id: 'no' }, label: t('ui.no') },
        { item: { kind: 'action', id: 'yes' }, label: t('ui.yes') },
      ];
    const slots = SLOTS.map((n): MenuEntry => {
      const info = this.store.info(n);
      const label = info
        ? t('title.slot_used', {
            n,
            time: formatPlaytime(info.playtimeMs),
            date: formatDate(info.updatedAt),
          })
        : t('title.slot_new', { n });
      return {
        item: { kind: 'action', id: `slot_${n}`, disabled: mode.kind === 'delete' && !info },
        label,
      };
    });
    if (mode.kind === 'delete')
      return [...slots, { item: { kind: 'action', id: 'back' }, label: t('ui.back') }];
    const language = settings().language;
    return [
      ...slots,
      { item: { kind: 'action', id: 'settings' }, label: t('title.settings') },
      {
        item: {
          kind: 'choice',
          id: 'language',
          options: languages,
          value: languages.indexOf(language),
        },
        label: t('ui.choice', { name: t('settings.language'), value: t(`language.${language}`) }),
      },
      {
        item: { kind: 'action', id: 'delete', disabled: !SLOTS.some((n) => this.store.info(n)) },
        label: t('title.delete'),
      },
    ];
  }

  private onMenu(e: MenuEvent): void {
    const mode = this.mode;
    if (e.type === 'back') {
      if (mode.kind !== 'main') this.setMode({ kind: 'main' }, 'delete');
      return;
    }
    if (e.type === 'change' && e.id === 'language') {
      updateSettings((s) => (s.language = languages[e.value]!));
      return;
    }
    if (e.type !== 'activate') return;
    const slot = /^slot_(\d)$/.exec(e.id);
    if (mode.kind === 'main') {
      if (slot) this.scene.start(SceneKey.World, { slot: Number(slot[1]) });
      else if (e.id === 'delete') this.setMode({ kind: 'delete' });
      else if (e.id === 'settings') {
        this.scene.launch(SceneKey.Settings, { from: SceneKey.Title });
        this.scene.pause();
      }
    } else if (mode.kind === 'delete') {
      if (slot) this.setMode({ kind: 'confirm', slot: Number(slot[1]) });
      else this.setMode({ kind: 'main' }, 'delete');
    } else {
      if (e.id === 'yes') this.store.clear(mode.slot);
      this.setMode({ kind: 'main' }, `slot_${mode.slot}`);
    }
  }

  private setMode(mode: Mode, focus?: string): void {
    this.mode = mode;
    this.menu.refresh();
    if (focus) this.menu.focusOn(focus);
  }
}

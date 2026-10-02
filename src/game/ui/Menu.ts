import Phaser from 'phaser';
import {
  firstFocus,
  navigate,
  type MenuEvent,
  type MenuInput,
  type MenuItem,
} from '../../logic/ui/menu';
import { FONT_PX, textStyle, UI_ACCENT, UI_COLOR } from './text';

export interface MenuEntry {
  item: MenuItem;
  /** The row's text, value included (e.g. "Music  < 60% >"). */
  label: string;
}

export interface MenuOptions {
  /** Centre x and the top row's y. */
  x: number;
  y: number;
  /** Row pitch in px. */
  lineHeight?: number;
  onEvent(event: MenuEvent, menu: Menu): void;
}

/** What the `getMenu` debug hook reports. */
export interface MenuSnapshot {
  focused: string | null;
  items: { id: string; label: string; disabled: boolean }[];
  /** Each row's bounds as fractions (0..1) of the canvas, for tapping it in specs. */
  rects: { x: number; y: number; width: number; height: number }[];
}

/** Live menus by scene key, for the debug hooks. */
const live = new Map<string, Menu>();

export function menuSnapshot(sceneKey: string): MenuSnapshot | null {
  return live.get(sceneKey)?.snapshot() ?? null;
}

const FOCUS_BG = 'rgba(194, 178, 128, 0.25)';
const DISABLED = '#7a7464';

/**
 * A vertical list of centred rows (centred, so it reads the same in RTL). Keyboard and gamepad
 * input arrives through `handle` (the scene owns a MenuInputReader, so it can capture keys
 * itself); a tap focuses a row and confirms it, or on a slider or choice steps it by the side of
 * the row that was tapped. `build` is called again on `refresh`, after the scene changed what it
 * shows.
 */
export class Menu {
  focus: number;
  private entries: MenuEntry[] = [];
  private rows: Phaser.GameObjects.Text[] = [];
  private readonly lineHeight: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly build: () => MenuEntry[],
    private readonly opts: MenuOptions,
  ) {
    this.lineHeight = opts.lineHeight ?? FONT_PX * 2;
    this.entries = build();
    this.focus = firstFocus(this.items);
    this.render();
    const key = scene.sys.settings.key;
    live.set(key, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (live.get(key) === this) live.delete(key);
    });
  }

  snapshot(): MenuSnapshot {
    const { width, height } = this.scene.scale;
    return {
      focused: this.focusedId,
      items: this.entries.map((e) => ({
        id: e.item.id,
        label: e.label,
        disabled: !!e.item.disabled,
      })),
      rects: this.rows.map((r) => {
        const b = r.getBounds();
        return {
          x: b.x / width,
          y: b.y / height,
          width: b.width / width,
          height: b.height / height,
        };
      }),
    };
  }

  get items(): MenuItem[] {
    return this.entries.map((e) => e.item);
  }

  /** The focused item's id, or null. */
  get focusedId(): string | null {
    return this.entries[this.focus]?.item.id ?? null;
  }

  /** Bottom of the last row, for laying out what's under the menu. */
  get bottom(): number {
    return this.opts.y + this.entries.length * this.lineHeight;
  }

  handle(input: MenuInput): void {
    const { focus, event } = navigate(this.items, this.focus, input);
    const moved = focus !== this.focus;
    this.focus = focus;
    if (moved) this.paint();
    if (event.type !== 'none') this.opts.onEvent(event, this);
  }

  /** Focuses the item `id` if it's there. */
  focusOn(id: string): void {
    const i = this.entries.findIndex((e) => e.item.id === id && !e.item.disabled);
    if (i >= 0) {
      this.focus = i;
      this.paint();
    }
  }

  /** Rebuilds the rows (labels, values, language), keeping the focused item when it's still there. */
  refresh(): void {
    const id = this.focusedId;
    this.entries = this.build();
    const keep = this.entries.findIndex((e) => e.item.id === id && !e.item.disabled);
    this.focus = keep >= 0 ? keep : firstFocus(this.items);
    this.render();
  }

  destroy(): void {
    this.clear();
    const key = this.scene.sys.settings.key;
    if (live.get(key) === this) live.delete(key);
  }

  private clear(): void {
    for (const r of this.rows) r.destroy();
    this.rows = [];
  }

  private render(): void {
    this.clear();
    this.rows = this.entries.map((entry, i) => {
      const row = this.scene.add
        .text(this.opts.x, this.opts.y + i * this.lineHeight, entry.label, {
          ...textStyle(),
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0);
      if (!entry.item.disabled) {
        row.setInteractive({ useHandCursor: true });
        row.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) =>
          this.tap(i, p.x < row.x),
        );
      }
      return row;
    });
    this.paint();
  }

  private tap(index: number, leftSide: boolean): void {
    this.focus = index;
    this.paint();
    const item = this.entries[index]!.item;
    this.handle(
      item.kind === 'slider' || item.kind === 'choice' ? (leftSide ? 'left' : 'right') : 'confirm',
    );
  }

  private paint(): void {
    this.rows.forEach((row, i) => {
      const item = this.entries[i]!.item;
      const focused = i === this.focus;
      row.setColor(item.disabled ? DISABLED : focused ? UI_ACCENT : UI_COLOR);
      row.setBackgroundColor(focused ? FOCUS_BG : 'transparent');
    });
  }
}

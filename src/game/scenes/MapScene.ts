import Phaser from 'phaser';
import { isRtl, t } from '../../i18n/i18n';
import { keyNameFromEvent } from '../../logic/input/keybinds';
import { GAME_HEIGHT, GAME_WIDTH } from '../../logic/scale';
import type { MapMarkerKind, MapView } from '../../logic/world/mapScreen';
import { settings } from '../settings';
import { MenuInputReader } from '../ui/MenuInput';
import { textStyle, UI_ACCENT } from '../ui/text';
import { SceneKey } from './keys';

/** Where the map grid may go: below the title, above the legend. */
export const MAP_AREA = { x: 16, y: 28, width: GAME_WIDTH - 32, height: GAME_HEIGHT - 56 };

const CELL_FILL = 0x5c5440;
const CELL_EDGE = 0x8a7f5a;
const CURRENT_EDGE = 0xf0e6c8;
const MARKER: Record<MapMarkerKind, { color: number; size: number; hollow?: boolean }> = {
  depot: { color: 0x6fbf4a, size: 5 },
  pickup: { color: 0xffd23f, size: 3 },
  pickup_taken: { color: 0x9a9480, size: 3, hollow: true },
};
const PAWN_COLOR = 0xff5a3c;

let lastView: MapView | null = null;

/** The view the open map shows, for the `getMapView` debug hook. */
export function openMapView(): MapView | null {
  return lastView;
}

/**
 * The map overlay over the paused WorldScene. WorldScene lays it out (`logic/world/mapScreen`)
 * and passes the view in; this only draws it. The map key (M/Tab by default), Esc, B, Start,
 * Select or a tap closes it.
 */
export class MapScene extends Phaser.Scene {
  private input$!: MenuInputReader;

  constructor() {
    super(SceneKey.Map);
  }

  create(view: MapView): void {
    lastView = view;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (lastView = null));
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85).setOrigin(0);
    this.add
      .text(GAME_WIDTH / 2, 8, t('map.title'), textStyle(1, { color: UI_ACCENT }))
      .setOrigin(0.5, 0);

    const g = this.add.graphics();
    for (const c of view.cells) {
      g.fillStyle(CELL_FILL).fillRect(c.x, c.y, c.w, c.h);
      g.lineStyle(1, CELL_EDGE).strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
    }
    for (const c of view.cells.filter((c) => c.current))
      g.lineStyle(1, CURRENT_EDGE).strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
    for (const m of view.markers) this.marker(g, m.kind, m.x, m.y);
    const pawn = this.add.rectangle(
      Math.round(view.pawn.x),
      Math.round(view.pawn.y),
      4,
      4,
      PAWN_COLOR,
    );
    this.tweens.add({ targets: pawn, alpha: 0.2, duration: 400, yoyo: true, repeat: -1 });
    this.legend();

    this.input$ = new MenuInputReader(this);
    // A tap anywhere closes it; the click must start here, not be the one that opened it.
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.close());
  }

  override update(): void {
    const { inputs, codes } = this.input$.poll();
    const mapKeys = settings().keybinds.map;
    const mapKey = codes.some((c) => {
      const name = keyNameFromEvent(c);
      return name !== null && mapKeys.includes(name);
    });
    if (mapKey || inputs.includes('back')) this.close();
  }

  private marker(g: Phaser.GameObjects.Graphics, kind: MapMarkerKind, x: number, y: number): void {
    const { color, size, hollow } = MARKER[kind];
    const left = Math.round(x - size / 2);
    const top = Math.round(y - size / 2);
    if (hollow) g.lineStyle(1, color).strokeRect(left + 0.5, top + 0.5, size - 1, size - 1);
    else g.fillStyle(color).fillRect(left, top, size, size);
  }

  /** Icon + label pairs along the bottom, in reading order. */
  private legend(): void {
    const items: [MapMarkerKind | 'pawn', string][] = [
      ['pawn', t('map.legend_you')],
      ['depot', t('map.legend_depot')],
      ['pickup', t('map.legend_pickup')],
      ['pickup_taken', t('map.legend_taken')],
    ];
    const rtl = isRtl();
    const y = GAME_HEIGHT - 18;
    const g = this.add.graphics();
    let x = rtl ? GAME_WIDTH - 24 : 24;
    for (const [kind, label] of items) {
      if (kind === 'pawn') g.fillStyle(PAWN_COLOR).fillRect(x - 2, y + 2, 4, 4);
      else this.marker(g, kind, x, y + 4);
      const text = this.add
        .text(x + (rtl ? -6 : 6), y, label, textStyle())
        .setOrigin(rtl ? 1 : 0, 0);
      x += (rtl ? -1 : 1) * (text.width + 22);
    }
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume(SceneKey.World);
  }
}

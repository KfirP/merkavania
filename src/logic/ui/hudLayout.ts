import { GAME_HEIGHT, GAME_WIDTH } from '../scale';

/**
 * Where each HUD element sits (docs/ARCHITECTURE.md, i18n: the HUD mirrors in RTL). The status
 * block (Mk tier and main-gun rounds, selected secondary and repair kits, HP) hugs the bottom
 * corner on the reading side; the minimap the top corner opposite it.
 */
export const HUD_ELEMENTS = [
  'tier',
  'gun',
  'secondary',
  'repair',
  'hpBar',
  'hpText',
  'minimap',
] as const;
export type HudElement = (typeof HUD_ELEMENTS)[number];

export interface HudAnchor {
  x: number;
  y: number;
  /** Text origin: 0 grows rightwards from x, 1 leftwards. */
  originX: number;
  /** Which way rows of icons (gun pips, minimap columns) run from x: 1 right, -1 left. */
  dir: 1 | -1;
}

export const MARGIN = 4;
export const HP_BAR = { width: 60, height: 4 };
/** One chunk on the minimap (chunks are 30×17 tiles). */
export const MINIMAP_CELL = { w: 12, h: 7 };
/** Gun-round pip size and pitch. */
export const PIP = { size: 3, pitch: 5 };

const ROW = 11;

const LTR: Record<HudElement, HudAnchor> = {
  hpBar: { x: MARGIN, y: GAME_HEIGHT - MARGIN - HP_BAR.height, originX: 0, dir: 1 },
  hpText: { x: MARGIN + HP_BAR.width + 4, y: GAME_HEIGHT - MARGIN - 7, originX: 0, dir: 1 },
  secondary: { x: MARGIN, y: GAME_HEIGHT - MARGIN - HP_BAR.height - 3 - ROW, originX: 0, dir: 1 },
  repair: { x: MARGIN + 96, y: GAME_HEIGHT - MARGIN - HP_BAR.height - 3 - ROW, originX: 0, dir: 1 },
  tier: { x: MARGIN, y: GAME_HEIGHT - MARGIN - HP_BAR.height - 3 - 2 * ROW, originX: 0, dir: 1 },
  gun: { x: MARGIN + 36, y: GAME_HEIGHT - MARGIN - HP_BAR.height - 2 * ROW, originX: 0, dir: 1 },
  minimap: { x: GAME_WIDTH - MARGIN, y: MARGIN, originX: 1, dir: -1 },
};

export function hudLayout(rtl: boolean): Record<HudElement, HudAnchor> {
  if (!rtl) return LTR;
  return Object.fromEntries(
    HUD_ELEMENTS.map((id) => {
      const a = LTR[id];
      return [id, { x: GAME_WIDTH - a.x, y: a.y, originX: 1 - a.originX, dir: -a.dir }];
    }),
  ) as Record<HudElement, HudAnchor>;
}

/** Left edge of a span `width` wide that starts at `x` in LTR, mirrored in RTL. */
export function mirrorX(x: number, width: number, rtl: boolean): number {
  return rtl ? GAME_WIDTH - x - width : x;
}

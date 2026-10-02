import type Phaser from 'phaser';
import { isRtl } from '../../i18n/i18n';

/** Asset key and CSS family of the UI font (Latin + Hebrew), loaded by BootScene. */
export const UI_FONT = 'font_ui';
/** The font's pixel grid: sizes should be multiples of it to stay crisp. */
export const FONT_PX = 8;

export const UI_COLOR = '#f0e6c8';
export const UI_ACCENT = '#c2b280';
/** Translucent black behind HUD text so it reads over any terrain. */
export const UI_PANEL = 'rgba(0, 0, 0, 0.6)';

/**
 * Text style for every player-facing string: the pixel UI font at a multiple of its grid, `rtl`
 * in Hebrew. `size` is in font pixels (1 = 8px).
 */
export function textStyle(
  size = 1,
  extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: UI_FONT,
    fontSize: `${size * FONT_PX}px`,
    color: UI_COLOR,
    rtl: isRtl(),
    // Phaser's measured metrics for this font overlap lines and clip descenders; pin them.
    metrics: { ascent: 7 * size, descent: 2 * size, fontSize: 9 * size },
    ...extra,
  };
}

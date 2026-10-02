import { GAME_HEIGHT, GAME_WIDTH } from '../scale';

/**
 * Touch buttons (GAME_DESIGN.md, Controls), game px. ALT, mortar, hatch and swap sit above the
 * right stick; repair above the left; map and pause at the top centre, clear of the minimap in
 * either reading direction. TouchControlsScene draws them and hit-tests through here.
 */
export const touchButtonIds = ['alt', 'mortar', 'hatch', 'swap', 'repair', 'map', 'pause'] as const;
export type TouchButtonId = (typeof touchButtonIds)[number];

export interface TouchButton {
  x: number;
  y: number;
  r: number;
}

export const TOUCH_BUTTONS: Readonly<Record<TouchButtonId, TouchButton>> = {
  alt: { x: GAME_WIDTH - 30, y: GAME_HEIGHT - 110, r: 16 },
  // Left of ALT; shown once the tank has the mortar.
  mortar: { x: GAME_WIDTH - 70, y: GAME_HEIGHT - 110, r: 14 },
  // Above ALT; shown once the tank has the scout.
  hatch: { x: GAME_WIDTH - 30, y: GAME_HEIGHT - 150, r: 14 },
  // Left of the hatch; shown with more than one secondary.
  swap: { x: GAME_WIDTH - 70, y: GAME_HEIGHT - 150, r: 12 },
  // Above the left stick; shown while there's a repair charge.
  repair: { x: 30, y: GAME_HEIGHT - 120, r: 13 },
  map: { x: GAME_WIDTH / 2 - 18, y: 14, r: 10 },
  pause: { x: GAME_WIDTH / 2 + 18, y: 14, r: 10 },
};

/** Extra reach around each button, game px. */
export const TOUCH_SLOP = 4;

/** The visible button under (x, y), or null. */
export function hitTouchButton(
  x: number,
  y: number,
  visible: (id: TouchButtonId) => boolean,
): TouchButtonId | null {
  for (const id of touchButtonIds) {
    const b = TOUCH_BUTTONS[id];
    if (visible(id) && Math.hypot(x - b.x, y - b.y) <= b.r + TOUCH_SLOP) return id;
  }
  return null;
}

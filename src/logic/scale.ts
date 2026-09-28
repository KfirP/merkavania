export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;

/**
 * Zoom factor for the internal-resolution canvas: the largest integer that fits the window,
 * or the fractional fit when the window is smaller than 1x (portrait phones).
 */
export function computeZoom(
  windowWidth: number,
  windowHeight: number,
  baseWidth = GAME_WIDTH,
  baseHeight = GAME_HEIGHT,
): number {
  const fit = Math.min(windowWidth / baseWidth, windowHeight / baseHeight);
  if (!Number.isFinite(fit) || fit <= 0) return 1;
  return fit >= 1 ? Math.floor(fit) : fit;
}

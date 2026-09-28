/** Render depth span per elevation level; larger than any world y. */
export const LEVEL_DEPTH = 100_000;

/** Render depth: sorted by level, then y (docs/ARCHITECTURE.md, Elevation). */
export function depthFor(level: number, y: number): number {
  return level * LEVEL_DEPTH + y;
}

/** Tile layers drawn above every entity (canopies, overhangs). */
export const ABOVE_DEPTH = LEVEL_DEPTH * 10;

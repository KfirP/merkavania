import type { ChunkCoord } from '../world/chunks';

/** A minimap cell: no chunk there, a chunk not yet visited, visited, or the one you're in. */
export type MinimapCell = 'none' | 'unknown' | 'visited' | 'current';

/**
 * The HUD minimap: the chunks around `current` (radius 1, so 3×3), as rows top to bottom. Unknown
 * is a chunk that exists but hasn't been visited; the HUD leaves those blank, so it doesn't spoil
 * the map.
 */
export function minimapCells(
  chunks: readonly (ChunkCoord & { id: string })[],
  visited: readonly string[],
  current: string,
  radius = 1,
): MinimapCell[][] {
  const here = chunks.find((c) => c.id === current);
  const seen = new Set(visited);
  const rows: MinimapCell[][] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    const row: MinimapCell[] = [];
    for (let dx = -radius; dx <= radius; dx++) {
      const c = here && chunks.find((k) => k.cx === here.cx + dx && k.cy === here.cy + dy);
      row.push(!c ? 'none' : c.id === current ? 'current' : seen.has(c.id) ? 'visited' : 'unknown');
    }
    rows.push(row);
  }
  return rows;
}

/** Chunk coordinate math for world streaming (docs/ARCHITECTURE.md, Chunk streaming). */

export const TILE = 16;
export const CHUNK_W = 30;
export const CHUNK_H = 17;
export const CHUNK_PX_W = CHUNK_W * TILE;
export const CHUNK_PX_H = CHUNK_H * TILE;

/** Chunks kept loaded around the player: 3×3 loads, 5×5 unloads (hysteresis). */
export const LOAD_RADIUS = 1;
export const UNLOAD_RADIUS = 2;

export interface ChunkCoord {
  cx: number;
  cy: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `<biome>_x<XX>_y<YY>`, the chunk's file stem and the prefix of its persistent save keys. */
export function chunkId(biome: string, { cx, cy }: ChunkCoord): string {
  return `${biome}_x${pad(cx)}_y${pad(cy)}`;
}

export function chunkCoordAt(px: number, py: number): ChunkCoord {
  return { cx: Math.floor(px / CHUNK_PX_W), cy: Math.floor(py / CHUNK_PX_H) };
}

export function neighbourhood({ cx, cy }: ChunkCoord, radius: number): ChunkCoord[] {
  const out: ChunkCoord[] = [];
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) out.push({ cx: cx + dx, cy: cy + dy });
  return out;
}

export function chunksToLoad(center: ChunkCoord): ChunkCoord[] {
  return neighbourhood(center, LOAD_RADIUS);
}

export function chunksToUnload(loaded: readonly ChunkCoord[], center: ChunkCoord): ChunkCoord[] {
  return loaded.filter(
    (c) => Math.max(Math.abs(c.cx - center.cx), Math.abs(c.cy - center.cy)) > UNLOAD_RADIUS,
  );
}

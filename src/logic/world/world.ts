import { CHUNK_PX_H, CHUNK_PX_W, chunkCoordAt, type ChunkCoord } from './chunks';
import { resolveRelativePath } from './tiled';

/** A Tiled `.world` file: every chunk map and its pixel offset. */
export interface TiledWorld {
  type?: string;
  maps: { fileName: string; x: number; y: number; width?: number; height?: number }[];
}

export interface WorldChunk extends ChunkCoord {
  /** File stem, e.g. `test_x01_y00`. */
  id: string;
  /** public/-relative path of the chunk's `.tmj`. */
  path: string;
}

export interface ParsedWorld {
  biome: string;
  chunks: WorldChunk[];
}

const stem = (path: string) => (path.split('/').pop() ?? path).replace(/\.[^.]+$/, '');

/** Reads a `.world` loaded from `worldPath`; the biome id is the world's file stem. */
export function parseWorld(world: TiledWorld, worldPath: string): ParsedWorld {
  const chunks = world.maps.map((m) => {
    if (m.x % CHUNK_PX_W !== 0 || m.y % CHUNK_PX_H !== 0)
      throw new Error(`${m.fileName}: offset (${m.x}, ${m.y}) is not a multiple of the chunk size`);
    return {
      id: stem(m.fileName),
      path: resolveRelativePath(worldPath, m.fileName),
      ...chunkCoordAt(m.x, m.y),
    };
  });
  return { biome: stem(worldPath), chunks };
}

interface ObjectsOnly {
  layers: { name: string; objects?: { type?: string; name?: string; x: number; y: number }[] }[];
}

/** World-pixel position of the `spawn` object called `name`, searching every chunk. */
export function findSpawn(
  chunks: readonly WorldChunk[],
  mapOf: (chunkId: string) => ObjectsOnly,
  name: string,
): { x: number; y: number } | null {
  for (const chunk of chunks) {
    const objects = mapOf(chunk.id).layers.find((l) => l.name === 'objects')?.objects ?? [];
    const spawn = objects.find((o) => o.type === 'spawn' && o.name === name);
    if (spawn) return { x: chunk.cx * CHUNK_PX_W + spawn.x, y: chunk.cy * CHUNK_PX_H + spawn.y };
  }
  return null;
}

/** Pixel rectangle covering every chunk. */
export function worldBounds(chunks: readonly ChunkCoord[]) {
  const xs = chunks.map((c) => c.cx);
  const ys = chunks.map((c) => c.cy);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  return {
    x: x0 * CHUNK_PX_W,
    y: y0 * CHUNK_PX_H,
    width: (Math.max(...xs) - x0 + 1) * CHUNK_PX_W,
    height: (Math.max(...ys) - y0 + 1) * CHUNK_PX_H,
  };
}

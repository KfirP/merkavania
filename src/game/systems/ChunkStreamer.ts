import Phaser from 'phaser';
import {
  CHUNK_PX_H,
  CHUNK_PX_W,
  chunkCoordAt,
  chunkId,
  chunksToLoad,
  chunksToUnload,
} from '../../logic/world/chunks';
import { ABOVE_DEPTH } from '../../logic/world/depth';
import { parseChunkGrid, type GridMap, type WorldGrid } from '../../logic/world/grid';
import type { RawObject } from '../../logic/world/objects';
import type { ParsedWorld, WorldChunk } from '../../logic/world/world';
import { events } from '../events';

/** Tile layers drawn in game, with their depths. `elevation` is data only and never drawn. */
const DRAWN_LAYERS = [
  ['ground', -2],
  ['decor', -1],
  ['walls', -1],
  ['above', ABOVE_DEPTH],
] as const;

const DATA_ONLY_TILESETS = new Set(['tiles_elevation']);

/** Called after a chunk's cells are in the grid, and before they leave it. */
export interface ChunkHooks {
  onLoad(chunk: WorldChunk, objects: readonly RawObject[]): void;
  onUnload(chunk: WorldChunk): void;
}

interface LoadedChunk {
  chunk: WorldChunk;
  map: Phaser.Tilemaps.Tilemap;
  colliders: Phaser.Physics.Arcade.Collider[];
}

/**
 * Keeps the 3×3 chunks around the pawn loaded and drops those outside the 5×5 window
 * (docs/ARCHITECTURE.md, Chunk streaming). Chunk JSON is preloaded, so loading is synchronous.
 */
export class ChunkStreamer {
  private readonly byCoord = new Map<string, WorldChunk>();
  private readonly loaded = new Map<string, LoadedChunk>();
  private current: string | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: ParsedWorld,
    private readonly grid: WorldGrid,
    /** Adds the colliders for a chunk's walls layer; they're destroyed with the chunk. */
    private readonly addColliders: (
      walls: Phaser.Tilemaps.TilemapLayer,
    ) => Phaser.Physics.Arcade.Collider[],
    private readonly hooks?: ChunkHooks,
  ) {
    for (const c of world.chunks) this.byCoord.set(`${c.cx},${c.cy}`, c);
  }

  /** Id of the chunk the pawn is in (it may be a hole in the world). */
  get currentChunk(): string {
    return this.current ?? '';
  }

  get loadedChunks(): WorldChunk[] {
    return [...this.loaded.values()].map((l) => l.chunk);
  }

  /** Streams around world position (x, y); cheap when the pawn stays in the same chunk. */
  update(x: number, y: number): void {
    const center = chunkCoordAt(x, y);
    const id = chunkId(this.world.biome, center);
    if (id === this.current) return;
    this.current = id;

    for (const c of chunksToLoad(center)) {
      const chunk = this.byCoord.get(`${c.cx},${c.cy}`);
      if (chunk && !this.loaded.has(chunk.id)) this.load(chunk);
    }
    for (const c of chunksToUnload(this.loadedChunks, center))
      this.unload(chunkId(this.world.biome, c));
    events.emit('world:chunks', { chunk: id, loaded: [...this.loaded.keys()] });
  }

  destroy(): void {
    for (const id of [...this.loaded.keys()]) this.unload(id);
  }

  private load(chunk: WorldChunk): void {
    const map = this.scene.make.tilemap({ key: chunk.id });
    const tilesets = map.tilesets
      .filter((ts) => !DATA_ONLY_TILESETS.has(ts.name))
      .map((ts) => map.addTilesetImage(ts.name, ts.name))
      .filter((ts): ts is Phaser.Tilemaps.Tileset => ts !== null);
    const x = chunk.cx * CHUNK_PX_W;
    const y = chunk.cy * CHUNK_PX_H;

    const colliders: Phaser.Physics.Arcade.Collider[] = [];
    for (const [name, depth] of DRAWN_LAYERS) {
      const layer = map.createLayer(name, tilesets, x, y);
      if (!layer) throw new Error(`Chunk ${chunk.id} has no ${name} layer`);
      layer.setDepth(depth);
      if (name === 'walls') {
        layer.setCollisionByProperty({ solid: true });
        colliders.push(...this.addColliders(layer));
      }
    }

    const data = this.scene.cache.tilemap.get(chunk.id).data as GridMap;
    this.grid.add(chunk, parseChunkGrid(data));
    this.loaded.set(chunk.id, { chunk, map, colliders });
    const objects = data.layers.find((l) => l.name === 'objects')?.objects ?? [];
    this.hooks?.onLoad(chunk, objects as RawObject[]);
  }

  private unload(id: string): void {
    const loaded = this.loaded.get(id);
    if (!loaded) return;
    this.hooks?.onUnload(loaded.chunk);
    for (const c of loaded.colliders) c.destroy();
    loaded.map.destroy();
    this.grid.remove(loaded.chunk);
    this.loaded.delete(id);
  }
}

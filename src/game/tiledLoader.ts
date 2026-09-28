import Phaser from 'phaser';
import {
  embedTilesets,
  externalTilesetSources,
  resolveRelativePath,
  type TiledMap,
  type TiledTileset,
} from '../logic/world/tiled';
import { parseWorld, type ParsedWorld, type TiledWorld } from '../logic/world/world';

/** Tilesets are cached by path, so every chunk of a biome shares one copy. */
function tilesetCacheKey(tilesetPath: string): string {
  return `tileset:${tilesetPath}`;
}

/** Queues a `.tmj` map and, once it arrives, every external `.tsj` tileset it references. */
export function queueTiledMap(loader: Phaser.Loader.LoaderPlugin, key: string, path: string): void {
  loader.json(key, path);
  loader.once(`filecomplete-json-${key}`, (_key: string, _type: string, data: TiledMap) => {
    // A tileset another chunk already queued or cached is skipped by the loader.
    for (const source of externalTilesetSources(data)) {
      const tsPath = resolveRelativePath(path, source);
      loader.json(tilesetCacheKey(tsPath), tsPath);
    }
  });
}

/** Queues a `.world` file and then every chunk map it lists (keyed by chunk id). */
export function queueTiledWorld(
  loader: Phaser.Loader.LoaderPlugin,
  key: string,
  path: string,
): void {
  loader.json(key, path);
  loader.once(`filecomplete-json-${key}`, (_key: string, _type: string, data: TiledWorld) => {
    for (const chunk of parseWorld(data, path).chunks) queueTiledMap(loader, chunk.id, chunk.path);
  });
}

/**
 * Inlines the loaded tilesets and registers the map in the tilemap cache, so scenes can
 * `this.make.tilemap({ key })`. Tileset `name`s are asset-manifest image keys.
 */
export function registerTiledMap(scene: Phaser.Scene, key: string, path: string): void {
  const map = scene.cache.json.get(key) as TiledMap;
  const data = embedTilesets(
    map,
    (source) =>
      scene.cache.json.get(tilesetCacheKey(resolveRelativePath(path, source))) as
        TiledTileset | undefined,
  );
  scene.cache.tilemap.add(key, { format: Phaser.Tilemaps.Formats.TILED_JSON, data });
}

/** Registers every chunk of a loaded `.world` and returns the parsed world. */
export function registerTiledWorld(scene: Phaser.Scene, key: string, path: string): ParsedWorld {
  const world = parseWorld(scene.cache.json.get(key) as TiledWorld, path);
  for (const chunk of world.chunks) registerTiledMap(scene, chunk.id, chunk.path);
  return world;
}

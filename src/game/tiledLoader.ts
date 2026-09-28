import Phaser from 'phaser';
import {
  embedTilesets,
  externalTilesetSources,
  resolveRelativePath,
  type TiledMap,
  type TiledTileset,
} from '../logic/world/tiled';

function tilesetCacheKey(mapKey: string, source: string): string {
  return `${mapKey}::${source}`;
}

/** Queues a `.tmj` map and, once it arrives, every external `.tsj` tileset it references. */
export function queueTiledMap(loader: Phaser.Loader.LoaderPlugin, key: string, path: string): void {
  loader.json(key, path);
  loader.once(`filecomplete-json-${key}`, (_key: string, _type: string, data: TiledMap) => {
    for (const source of externalTilesetSources(data))
      loader.json(tilesetCacheKey(key, source), resolveRelativePath(path, source));
  });
}

/**
 * Inlines the loaded tilesets and registers the map in the tilemap cache, so scenes can
 * `this.make.tilemap({ key })`. Tileset `name`s are asset-manifest image keys.
 */
export function registerTiledMap(scene: Phaser.Scene, key: string): void {
  const map = scene.cache.json.get(key) as TiledMap;
  const data = embedTilesets(
    map,
    (source) => scene.cache.json.get(tilesetCacheKey(key, source)) as TiledTileset | undefined,
  );
  scene.cache.tilemap.add(key, { format: Phaser.Tilemaps.Formats.TILED_JSON, data });
}

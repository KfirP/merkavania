/**
 * Tiled JSON helpers. Our maps use external `.tsj` tilesets (docs/LEVEL_DESIGN.md), but Phaser 3
 * only understands embedded ones, so the loader fetches each `.tsj` and inlines it here.
 */

export interface TiledTilesetRef {
  firstgid: number;
  source: string;
}

export interface TiledTileset {
  firstgid?: number;
  name: string;
  [key: string]: unknown;
}

export interface TiledMap {
  tilesets: (TiledTilesetRef | TiledTileset)[];
  [key: string]: unknown;
}

function isRef(ts: TiledTilesetRef | TiledTileset): ts is TiledTilesetRef {
  return typeof (ts as TiledTilesetRef).source === 'string';
}

/** The `source` of every external tileset referenced by the map. */
export function externalTilesetSources(map: TiledMap): string[] {
  return map.tilesets.filter(isRef).map((ts) => ts.source);
}

/** Returns a copy of `map` with every external tileset reference replaced by its inlined data. */
export function embedTilesets(
  map: TiledMap,
  resolve: (source: string) => TiledTileset | undefined,
): TiledMap {
  return {
    ...map,
    tilesets: map.tilesets.map((ts) => {
      if (!isRef(ts)) return ts;
      const data = resolve(ts.source);
      if (!data) throw new Error(`Tileset "${ts.source}" was not loaded`);
      return { ...data, firstgid: ts.firstgid };
    }),
  };
}

/** Resolves `relative` against the directory of `basePath` (URL-style paths with '/'). */
export function resolveRelativePath(basePath: string, relative: string): string {
  const parts = basePath.split('/').slice(0, -1);
  for (const seg of relative.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.' && seg !== '') parts.push(seg);
  }
  return parts.join('/');
}

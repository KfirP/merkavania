import { describe, expect, it } from 'vitest';
import { embedTilesets, externalTilesetSources, resolveRelativePath, type TiledMap } from './tiled';

const map: TiledMap = {
  width: 2,
  tilesets: [
    { firstgid: 1, source: 'ground.tsj' },
    { firstgid: 17, name: 'inline', tilecount: 4 },
  ],
};

describe('externalTilesetSources', () => {
  it('lists only external references', () => {
    expect(externalTilesetSources(map)).toEqual(['ground.tsj']);
  });
});

describe('embedTilesets', () => {
  it('inlines external tilesets and keeps their firstgid', () => {
    const out = embedTilesets(map, (src) =>
      src === 'ground.tsj' ? { name: 'ground', tilecount: 16 } : undefined,
    );
    expect(out.tilesets).toEqual([
      { name: 'ground', tilecount: 16, firstgid: 1 },
      { firstgid: 17, name: 'inline', tilecount: 4 },
    ]);
    expect(out.width).toBe(2);
    expect(map.tilesets[0]).toEqual({ firstgid: 1, source: 'ground.tsj' });
  });

  it('throws on a missing tileset', () => {
    expect(() => embedTilesets(map, () => undefined)).toThrow('ground.tsj');
  });
});

describe('resolveRelativePath', () => {
  it('resolves against the base file directory', () => {
    expect(resolveRelativePath('maps/test/room.tmj', 'tiles.tsj')).toBe('maps/test/tiles.tsj');
    expect(resolveRelativePath('maps/test/room.tmj', '../shared/./t.tsj')).toBe(
      'maps/shared/t.tsj',
    );
  });
});

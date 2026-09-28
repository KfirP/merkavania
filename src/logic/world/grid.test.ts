import { describe, expect, it } from 'vitest';
import { CHUNK_H, CHUNK_W } from './chunks';
import { parseChunkGrid, WorldGrid, type GridMap } from './grid';

/** 3×2 map; tileset A (firstgid 1): 0 sand, 1 road, 2 solid. Tileset B (firstgid 10): elevation. */
const tilesets = [
  {
    name: 'tiles_test',
    firstgid: 1,
    tiles: [
      { id: 0, properties: [{ name: 'terrain', type: 'string', value: 'sand' }] },
      { id: 1, properties: [{ name: 'terrain', type: 'string', value: 'road' }] },
      { id: 2, properties: [{ name: 'solid', type: 'bool', value: true }] },
    ],
  },
  {
    name: 'tiles_elevation',
    firstgid: 10,
    tiles: [
      { id: 1, properties: [{ name: 'level', type: 'int', value: 1 }] },
      {
        id: 4,
        properties: [
          { name: 'level', type: 'int', value: 0 },
          { name: 'ramp', type: 'string', value: 'e' },
          { name: 'steep', type: 'bool', value: true },
        ],
      },
    ],
  },
];

const map: GridMap = {
  width: 3,
  height: 2,
  tilesets,
  layers: [
    { name: 'ground', type: 'tilelayer', data: [1, 2, 1, 1, 1, 0] },
    { name: 'elevation', type: 'tilelayer', data: [0, 14, 11, 0, 0, 0] },
    // 0x80000000 is Tiled's horizontal-flip flag; the tile underneath is still gid 3 (solid).
    { name: 'walls', type: 'tilelayer', data: [0, 0, 0, 3 | 0x80000000, 0, 0] },
    { name: 'objects', type: 'objectgroup', objects: [] },
  ],
};

describe('parseChunkGrid', () => {
  const grid = parseChunkGrid(map);

  it('reads terrain from the ground layer', () => {
    expect(grid.cells.map((c) => c.terrain)).toEqual([
      'sand',
      'road',
      'sand',
      'sand',
      'sand',
      null,
    ]);
  });

  it('reads level, ramp and steep from the elevation layer (empty = level 0)', () => {
    expect(grid.cells[0]).toMatchObject({ level: 0, ramp: null, steep: false });
    expect(grid.cells[1]).toMatchObject({ level: 0, ramp: 'e', steep: true });
    expect(grid.cells[2]).toMatchObject({ level: 1, ramp: null });
  });

  it('reads solid from the walls layer, ignoring flip flags', () => {
    expect(grid.cells.map((c) => c.solid)).toEqual([false, false, false, true, false, false]);
  });
});

describe('WorldGrid', () => {
  const chunkMap = (level: number): GridMap => ({
    width: CHUNK_W,
    height: CHUNK_H,
    tilesets,
    layers: [
      {
        name: 'elevation',
        type: 'tilelayer',
        data: new Array<number>(CHUNK_W * CHUNK_H).fill(level ? 11 : 0),
      },
    ],
  });

  it('looks cells up by world tile across loaded chunks', () => {
    const world = new WorldGrid();
    world.add({ cx: 0, cy: 0 }, parseChunkGrid(chunkMap(0)));
    world.add({ cx: 1, cy: 0 }, parseChunkGrid(chunkMap(1)));
    expect(world.cellAt(CHUNK_W - 1, 0)?.level).toBe(0);
    expect(world.cellAt(CHUNK_W, 0)?.level).toBe(1);
    expect(world.cellAt(0, CHUNK_H)).toBeNull();
    expect(world.cellAt(-1, 0)).toBeNull();
  });

  it('forgets removed chunks', () => {
    const world = new WorldGrid();
    world.add({ cx: 0, cy: 0 }, parseChunkGrid(chunkMap(0)));
    world.remove({ cx: 0, cy: 0 });
    expect(world.cellAt(0, 0)).toBeNull();
  });
});

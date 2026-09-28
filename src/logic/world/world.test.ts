import { describe, expect, it } from 'vitest';
import { parseWorld, worldBounds, type TiledWorld } from './world';

const world: TiledWorld = {
  type: 'world',
  maps: [
    { fileName: 'test_x00_y00.tmj', x: 0, y: 0, width: 480, height: 272 },
    { fileName: 'test_x01_y00.tmj', x: 480, y: 0, width: 480, height: 272 },
    { fileName: 'test_x01_y01.tmj', x: 480, y: 272, width: 480, height: 272 },
  ],
};

describe('parseWorld', () => {
  it('reads the biome from the file name and each chunk from maps[]', () => {
    const parsed = parseWorld(world, 'maps/test/test.world');
    expect(parsed.biome).toBe('test');
    expect(parsed.chunks).toEqual([
      { id: 'test_x00_y00', path: 'maps/test/test_x00_y00.tmj', cx: 0, cy: 0 },
      { id: 'test_x01_y00', path: 'maps/test/test_x01_y00.tmj', cx: 1, cy: 0 },
      { id: 'test_x01_y01', path: 'maps/test/test_x01_y01.tmj', cx: 1, cy: 1 },
    ]);
  });

  it('rejects offsets that are not chunk multiples', () => {
    const bad: TiledWorld = {
      maps: [{ fileName: 'a.tmj', x: 16, y: 0, width: 480, height: 272 }],
    };
    expect(() => parseWorld(bad, 'maps/test/test.world')).toThrow('a.tmj');
  });
});

describe('worldBounds', () => {
  it('covers every chunk in pixels', () => {
    const { chunks } = parseWorld(world, 'maps/test/test.world');
    expect(worldBounds(chunks)).toEqual({ x: 0, y: 0, width: 960, height: 544 });
  });
});

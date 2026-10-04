import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BIOME,
  findSpawn,
  parseWorld,
  pickBiome,
  worldBounds,
  type TiledWorld,
} from './world';

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

describe('findSpawn', () => {
  const { chunks } = parseWorld(world, 'maps/test/test.world');
  const objects: Record<string, { type: string; name: string; x: number; y: number }[]> = {
    test_x01_y01: [
      { type: 'enemy', name: 'start', x: 1, y: 1 },
      { type: 'spawn', name: 'start', x: 16, y: 32 },
    ],
  };
  const mapOf = (id: string) => ({
    layers: [{ name: 'objects', type: 'objectgroup', objects: objects[id] ?? [] }],
  });

  it('returns the named spawn in world pixels', () => {
    expect(findSpawn(chunks, mapOf, 'start')).toEqual({ x: 480 + 16, y: 272 + 32 });
  });

  it('returns null when no chunk has it', () => {
    expect(findSpawn(chunks, mapOf, 'depot_1')).toBeNull();
  });
});

describe('worldBounds', () => {
  it('covers every chunk in pixels', () => {
    const { chunks } = parseWorld(world, 'maps/test/test.world');
    expect(worldBounds(chunks)).toEqual({ x: 0, y: 0, width: 960, height: 544 });
  });
});

describe('pickBiome', () => {
  const known = ['desert', 'test'];

  it('plays the desert unless a known biome is asked for (?world=test for the sandbox)', () => {
    expect(DEFAULT_BIOME).toBe('desert');
    expect(pickBiome(null, known)).toBe('desert');
    expect(pickBiome('test', known)).toBe('test');
    expect(pickBiome('moon', known)).toBe('desert');
  });
});

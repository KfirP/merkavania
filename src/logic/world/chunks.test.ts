import { describe, expect, it } from 'vitest';
import {
  CHUNK_H,
  CHUNK_PX_H,
  CHUNK_PX_W,
  CHUNK_W,
  chunkCoordAt,
  chunkId,
  chunksToLoad,
  chunksToUnload,
  neighbourhood,
} from './chunks';

describe('chunk constants', () => {
  it('are 30×17 tiles of 16px (LEVEL_DESIGN.md)', () => {
    expect([CHUNK_W, CHUNK_H]).toEqual([30, 17]);
    expect([CHUNK_PX_W, CHUNK_PX_H]).toEqual([480, 272]);
  });
});

describe('chunkId', () => {
  it('zero-pads the coordinates', () => {
    expect(chunkId('test', { cx: 2, cy: 0 })).toBe('test_x02_y00');
    expect(chunkId('desert', { cx: 11, cy: 7 })).toBe('desert_x11_y07');
  });
});

describe('chunkCoordAt', () => {
  it('maps pixel positions to chunk coordinates', () => {
    expect(chunkCoordAt(0, 0)).toEqual({ cx: 0, cy: 0 });
    expect(chunkCoordAt(479.9, 271.9)).toEqual({ cx: 0, cy: 0 });
    expect(chunkCoordAt(480, 272)).toEqual({ cx: 1, cy: 1 });
    expect(chunkCoordAt(1500, 600)).toEqual({ cx: 3, cy: 2 });
  });

  it('floors negative positions', () => {
    expect(chunkCoordAt(-1, -1)).toEqual({ cx: -1, cy: -1 });
  });
});

describe('neighbourhood', () => {
  it('lists the (2r+1)² square around the centre', () => {
    const n = neighbourhood({ cx: 5, cy: 5 }, 1);
    expect(n).toHaveLength(9);
    expect(n).toContainEqual({ cx: 4, cy: 4 });
    expect(n).toContainEqual({ cx: 6, cy: 6 });
    expect(neighbourhood({ cx: 0, cy: 0 }, 2)).toHaveLength(25);
  });
});

describe('streaming windows', () => {
  it('loads the 3×3 around the player', () => {
    expect(chunksToLoad({ cx: 1, cy: 1 })).toHaveLength(9);
  });

  it('unloads only chunks outside the 5×5 hysteresis window', () => {
    const loaded = [
      { cx: 0, cy: 0 },
      { cx: 2, cy: 0 },
      { cx: 3, cy: 0 },
      { cx: 0, cy: 3 },
    ];
    // Centre (0,0): x=2 is distance 2 (kept), x=3 and y=3 are distance 3 (dropped).
    expect(chunksToUnload(loaded, { cx: 0, cy: 0 })).toEqual([
      { cx: 3, cy: 0 },
      { cx: 0, cy: 3 },
    ]);
  });
});

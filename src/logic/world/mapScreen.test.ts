import { describe, expect, it } from 'vitest';
import { CHUNK_PX_H, CHUNK_PX_W } from './chunks';
import { buildMapView, type MapObjects } from './mapScreen';

const chunks = [
  { id: 'a', cx: 0, cy: 0 },
  { id: 'b', cx: 1, cy: 0 },
  { id: 'c', cx: 0, cy: 1 },
  { id: 'd', cx: 1, cy: 1 },
];
const area = { x: 20, y: 30, width: 440, height: 200 };

const objects: Record<string, MapObjects> = {
  a: {
    depots: [{ key: 'a:depot', x: 100, y: 100 }],
    pickups: [
      { key: 'a:kit', x: 200, y: 50 },
      { key: 'a:mortar', x: 300, y: 50 },
    ],
  },
  b: { depots: [{ key: 'b:depot', x: CHUNK_PX_W + 10, y: 10 }], pickups: [] },
  c: { depots: [], pickups: [{ key: 'c:plate', x: 10, y: CHUNK_PX_H + 10 }] },
  d: { depots: [], pickups: [] },
};

function view(visited: string[], current = 'a', pawn = { x: 240, y: 136 }) {
  return buildMapView({
    chunks,
    visited,
    current,
    pawn,
    objectsOf: (id) => objects[id]!,
    taken: (key) => key === 'a:kit',
    area,
  });
}

describe('buildMapView', () => {
  it('shows only visited chunks, flagging the current one', () => {
    const v = view(['a', 'c']);
    expect(v.cells.map((c) => [c.id, c.current])).toEqual([
      ['a', true],
      ['c', false],
    ]);
  });

  it('fits the whole world in the area, centred, with whole-pixel cells in chunk proportion', () => {
    const v = view(['a', 'b', 'c', 'd']);
    const xs = v.cells.map((c) => c.x);
    const ys = v.cells.map((c) => c.y);
    const right = Math.max(...v.cells.map((c) => c.x + c.w));
    const bottom = Math.max(...v.cells.map((c) => c.y + c.h));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(area.x);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(area.y);
    expect(right).toBeLessThanOrEqual(area.x + area.width);
    expect(bottom).toBeLessThanOrEqual(area.y + area.height);
    // Centred: equal slack on both sides (to a pixel).
    expect(Math.abs(Math.min(...xs) - area.x - (area.x + area.width - right))).toBeLessThanOrEqual(
      1,
    );
    expect(
      Math.abs(Math.min(...ys) - area.y - (area.y + area.height - bottom)),
    ).toBeLessThanOrEqual(1);
    for (const c of v.cells) {
      expect(Number.isInteger(c.w) && Number.isInteger(c.h)).toBe(true);
      expect(c.w / c.h).toBeCloseTo(CHUNK_PX_W / CHUNK_PX_H, 1);
    }
  });

  it('places the pawn within its chunk cell', () => {
    const v = view(['a'], 'a', { x: CHUNK_PX_W / 2, y: CHUNK_PX_H / 2 });
    const a = v.cells[0]!;
    expect(v.pawn.x).toBeCloseTo(a.x + a.w / 2, 0);
    expect(v.pawn.y).toBeCloseTo(a.y + a.h / 2, 0);
  });

  it('marks depots and pickups only in visited chunks, telling taken pickups apart', () => {
    const v = view(['a']);
    expect(v.markers.map((m) => [m.key, m.kind])).toEqual([
      ['a:depot', 'depot'],
      ['a:kit', 'pickup_taken'],
      ['a:mortar', 'pickup'],
    ]);
    const a = v.cells[0]!;
    for (const m of v.markers) {
      expect(m.x).toBeGreaterThanOrEqual(a.x);
      expect(m.x).toBeLessThanOrEqual(a.x + a.w);
    }
  });

  it('copes with nothing visited yet', () => {
    const v = view([]);
    expect(v.cells).toEqual([]);
    expect(v.markers).toEqual([]);
  });
});

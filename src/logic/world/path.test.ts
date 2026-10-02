import { describe, expect, it } from 'vitest';
import { TILE } from './chunks';
import type { Cell } from './grid';
import { findPath } from './path';

/** A map from rows: `#` solid, `c` crawlspace, `.` open. */
function grid(rows: string[]) {
  return (tx: number, ty: number): Cell | null => {
    const ch = rows[ty]?.[tx];
    if (ch === undefined) return null;
    return {
      level: 0,
      ramp: null,
      steep: false,
      terrain: ch === 'c' ? 'crawlspace' : null,
      solid: ch === '#',
    };
  };
}
const scout = { pawn: 'scout' as const, abilities: [] };
const tank = { pawn: 'tank' as const, abilities: [] };
const centre = (tx: number, ty: number) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });

describe('findPath', () => {
  it('walks around a wall, ending on the goal tile centre', () => {
    const cellAt = grid(['.....', '.###.', '.....']);
    const path = findPath(cellAt, { tx: 0, ty: 1 }, { tx: 4, ty: 1 }, scout)!;
    expect(path).not.toBeNull();
    expect(path.at(-1)).toEqual(centre(4, 1));
    // Up, four across and down again.
    expect(path).toHaveLength(6);
    let prev = centre(0, 1);
    for (const p of path) {
      expect(Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y)).toBe(TILE);
      prev = p;
    }
  });

  it('is empty when already on the goal', () => {
    expect(findPath(grid(['..']), { tx: 1, ty: 0 }, { tx: 1, ty: 0 }, scout)).toEqual([]);
  });

  it('crawls through crawlspace for the scout but not the tank', () => {
    const cellAt = grid(['#####', '.ccc.', '#####']);
    expect(findPath(cellAt, { tx: 0, ty: 1 }, { tx: 4, ty: 1 }, scout)).toHaveLength(4);
    expect(findPath(cellAt, { tx: 0, ty: 1 }, { tx: 4, ty: 1 }, tank)).toBeNull();
  });

  it('gives up when walled off or past its node budget', () => {
    expect(findPath(grid(['.#.']), { tx: 0, ty: 0 }, { tx: 2, ty: 0 }, scout)).toBeNull();
    const open = grid(Array.from({ length: 20 }, () => '.'.repeat(20)));
    expect(findPath(open, { tx: 0, ty: 0 }, { tx: 19, ty: 19 }, scout, 10)).toBeNull();
  });
});

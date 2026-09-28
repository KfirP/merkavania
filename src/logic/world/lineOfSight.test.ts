import { describe, expect, it } from 'vitest';
import { TILE } from './chunks';
import type { Cell } from './grid';
import { hasLineOfSight } from './lineOfSight';

const cell = (over: Partial<Cell> = {}): Cell => ({
  level: 0,
  ramp: null,
  steep: false,
  terrain: 'sand',
  solid: false,
  ...over,
});

/** A 20×5 strip: row 2 is the line of fire; `special` overrides one tile. */
function grid(special: Record<string, Partial<Cell>> = {}) {
  return (tx: number, ty: number): Cell | null => {
    if (tx < 0 || ty < 0 || tx >= 20 || ty >= 5) return null;
    return cell(special[`${tx},${ty}`]);
  };
}

const at = (tx: number) => ({ x: (tx + 0.5) * TILE, y: 2.5 * TILE });

describe('hasLineOfSight', () => {
  it('sees across open ground', () => {
    expect(hasLineOfSight(at(1), at(18), 0, grid())).toBe(true);
  });

  it('is blocked by a wall on its level', () => {
    expect(hasLineOfSight(at(1), at(18), 0, grid({ '9,2': { solid: true } }))).toBe(false);
  });

  it('sees over a lower wall from higher ground', () => {
    const cells = grid({ '9,2': { solid: true, level: 0 } });
    expect(hasLineOfSight(at(1), at(18), 1, cells)).toBe(true);
  });

  it('is blocked by rising ground (a cliff face)', () => {
    expect(hasLineOfSight(at(1), at(18), 0, grid({ '9,2': { level: 1 } }))).toBe(false);
  });

  it('is blocked by unloaded cells', () => {
    expect(hasLineOfSight(at(1), { x: 25 * TILE, y: 2.5 * TILE }, 0, grid())).toBe(false);
  });

  it('catches a one-tile wall on a diagonal', () => {
    const cells = grid({ '7,2': { solid: true } });
    expect(hasLineOfSight({ x: 1.5 * TILE, y: 0.5 * TILE }, at(9), 0, cells)).toBe(false);
  });
});

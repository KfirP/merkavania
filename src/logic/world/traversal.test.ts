import { describe, expect, it } from 'vitest';
import type { Cell } from './grid';
import {
  canEnter,
  constrainMove,
  levelAt,
  projectileBlocked,
  speedMulAt,
  wallBlocksProjectile,
  type MoveContext,
} from './traversal';

const cell = (over: Partial<Cell> = {}): Cell => ({
  level: 0,
  ramp: null,
  steep: false,
  terrain: 'sand',
  solid: false,
  ...over,
});

const tank: MoveContext = { pawn: 'tank', abilities: [] };

describe('canEnter', () => {
  it('allows flat ground and blocks solid tiles and unloaded cells', () => {
    expect(canEnter(cell(), cell(), 'e', tank)).toBe(true);
    expect(canEnter(cell(), cell({ solid: true }), 'e', tank)).toBe(false);
    expect(canEnter(cell(), null, 'e', tank)).toBe(false);
  });

  it('blocks cliffs up and down', () => {
    expect(canEnter(cell(), cell({ level: 1 }), 'n', tank)).toBe(false);
    expect(canEnter(cell({ level: 1 }), cell(), 's', tank)).toBe(false);
  });

  it('lets a ramp climb one level in its direction and descend the opposite way', () => {
    const ramp = cell({ ramp: 'n' });
    expect(canEnter(ramp, cell({ level: 1 }), 'n', tank)).toBe(true);
    expect(canEnter(cell({ level: 1 }), ramp, 's', tank)).toBe(true);
  });

  it('blocks leaving or entering a ramp across its sides', () => {
    const ramp = cell({ ramp: 'n' });
    expect(canEnter(ramp, cell({ level: 1 }), 'e', tank)).toBe(false);
    expect(canEnter(cell({ level: 1 }), ramp, 'w', tank)).toBe(false);
  });

  it('allows moving on and off a ramp at its own level', () => {
    const ramp = cell({ ramp: 'n' });
    expect(canEnter(cell(), ramp, 'n', tank)).toBe(true);
    expect(canEnter(ramp, cell(), 'e', tank)).toBe(true);
  });

  it('never climbs two levels, even on a ramp', () => {
    expect(canEnter(cell({ ramp: 'n' }), cell({ level: 2 }), 'n', tank)).toBe(false);
  });

  it('needs suspension for steep ramps', () => {
    const steep = cell({ level: 1, ramp: 'e', steep: true });
    const top = cell({ level: 2 });
    expect(canEnter(steep, top, 'e', tank)).toBe(false);
    expect(canEnter(top, steep, 'w', tank)).toBe(false);
    const mk3: MoveContext = { pawn: 'tank', abilities: ['suspension'] };
    expect(canEnter(steep, top, 'e', mk3)).toBe(true);
    expect(canEnter(top, steep, 'w', mk3)).toBe(true);
  });

  it('gates terrain by ability', () => {
    expect(canEnter(cell(), cell({ terrain: 'mud' }), 'e', tank)).toBe(false);
    expect(
      canEnter(cell(), cell({ terrain: 'mud' }), 'e', { pawn: 'tank', abilities: ['wide_tracks'] }),
    ).toBe(true);
    // Hazards are enterable; their damage arrives with combat.
    expect(canEnter(cell(), cell({ terrain: 'minefield' }), 'e', tank)).toBe(true);
  });

  it('gates terrain by pawn', () => {
    expect(canEnter(cell(), cell({ terrain: 'crawlspace' }), 'e', tank)).toBe(false);
    expect(
      canEnter(cell(), cell({ terrain: 'crawlspace' }), 'e', { pawn: 'scout', abilities: [] }),
    ).toBe(true);
  });
});

/** A 10×10 world grid from rows of chars: '.' sand, '1' level 1, '^' ramp up north, '#' solid. */
function gridFrom(rows: string[]) {
  return (tx: number, ty: number): Cell | null => {
    const ch = rows[ty]?.[tx];
    if (ch === undefined) return null;
    if (ch === '1') return cell({ level: 1 });
    if (ch === '^') return cell({ ramp: 'n' });
    if (ch === '#') return cell({ solid: true });
    return cell();
  };
}

describe('constrainMove', () => {
  const cellAt = gridFrom([
    '..........',
    '..........',
    '..........',
    '....1111..',
    '....1111..',
    '....^^^^..',
    '....^^^^..',
    '..........',
    '..........',
    '..........',
  ]);
  const r = 10;

  it('keeps free movement unchanged', () => {
    const m = constrainMove({ x: 40, y: 40 }, r, 50, 30, 0.1, cellAt, tank);
    expect(m).toEqual({ vx: 50, vy: 30, blockedX: false, blockedY: false });
  });

  it('stops at a cliff edge exactly at the tile boundary', () => {
    // Driving east at y=56 (row 3) toward the plateau at x=64.
    const m = constrainMove({ x: 50, y: 56 }, r, 100, 0, 0.1, cellAt, tank);
    expect(m.blockedX).toBe(true);
    expect(m.vx * 0.1).toBeCloseTo(64 - (50 + r));
  });

  it('keeps sliding along a cliff on the free axis', () => {
    const m = constrainMove({ x: 50, y: 56 }, r, 100, 40, 0.1, cellAt, tank);
    expect(m.blockedX).toBe(true);
    expect(m.vy).toBe(40);
  });

  it('climbs a ramp that is wide enough for the body', () => {
    // Centred on the 4-wide ramp, moving north from row 5 into the plateau at row 4.
    const m = constrainMove({ x: 96, y: 96 }, r, 0, -100, 0.1, cellAt, tank);
    expect(m.blockedY).toBe(false);
    expect(m.vy).toBe(-100);
  });

  it('blocks a ramp when part of the body would straddle the cliff beside it', () => {
    // Straddling the ramp's west edge: entering row 4 would put the body on both the flat
    // ground at column 3 and the plateau at column 4.
    const m = constrainMove({ x: 66, y: 96 }, r, 0, -100, 0.1, cellAt, tank);
    expect(m.blockedY).toBe(true);
  });

  it('pushes a body that has poked into a forbidden cell back out', () => {
    // East edge at 65, 1px into the plateau column that starts at 64.
    const m = constrainMove({ x: 55, y: 56 }, r, 50, 0, 0.1, cellAt, tank);
    expect(m.blockedX).toBe(true);
    expect(m.vx * 0.1).toBeCloseTo(-1);
  });

  it('blocks solid tiles and the edge of the loaded world', () => {
    const walls = gridFrom(['..#', '...', '...']);
    expect(constrainMove({ x: 20, y: 8 }, 6, 100, 0, 0.1, walls, tank).blockedX).toBe(true);
    expect(constrainMove({ x: 8, y: 8 }, 6, 0, -100, 0.1, walls, tank).blockedY).toBe(true);
  });
});

describe('levelAt and speedMulAt', () => {
  it('read the cell under the centre', () => {
    const cellAt = gridFrom(['..', '.1']);
    expect(levelAt(20, 20, cellAt)).toBe(1);
    expect(levelAt(4, 4, cellAt)).toBe(0);
    expect(levelAt(-50, 4, cellAt)).toBe(0);
  });

  it('use the terrain table, defaulting to 1', () => {
    expect(speedMulAt(cell({ terrain: 'road' }))).toBeGreaterThan(1);
    expect(speedMulAt(cell({ terrain: null }))).toBe(1);
    expect(speedMulAt(null)).toBe(1);
  });
});

describe('projectiles and levels', () => {
  it('are stopped by higher cells and fly over lower ones', () => {
    expect(projectileBlocked(0, cell({ level: 1 }))).toBe(true);
    expect(projectileBlocked(1, cell({ level: 0 }))).toBe(false);
    expect(projectileBlocked(1, cell({ level: 1 }))).toBe(false);
  });

  it('are stopped by walls at or above their level', () => {
    expect(wallBlocksProjectile(0, 0)).toBe(true);
    expect(wallBlocksProjectile(1, 0)).toBe(true);
    expect(wallBlocksProjectile(0, 1)).toBe(false);
  });
});

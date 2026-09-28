import { describe, expect, it } from 'vitest';
import { offsetFrom } from './geometry';

describe('offsetFrom', () => {
  it('moves forward along the angle', () => {
    const p = offsetFrom(10, 10, 0, 5, 0);
    expect(p.x).toBeCloseTo(15);
    expect(p.y).toBeCloseTo(10);
  });

  it('puts a positive left offset on the left of the facing (screen y down)', () => {
    // Facing east, left is north (−y).
    const east = offsetFrom(0, 0, 0, 0, 4);
    expect(east.x).toBeCloseTo(0);
    expect(east.y).toBeCloseTo(-4);
    // Facing north, left is west (−x).
    const north = offsetFrom(0, 0, -Math.PI / 2, 0, 4);
    expect(north.x).toBeCloseTo(-4);
    expect(north.y).toBeCloseTo(0);
  });

  it('places the turret pivot behind the hull centre for a negative forward offset', () => {
    const p = offsetFrom(0, 0, 0, -3, 0);
    expect(p.x).toBeCloseTo(-3);
  });
});

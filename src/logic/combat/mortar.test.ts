import { describe, expect, it } from 'vitest';
import { arcHeight, flightTime, lobTarget } from './mortar';

const lob = { minRange: 48, maxRange: 220 };

describe('lobTarget', () => {
  it('lands at the chosen distance along the aim', () => {
    const t = lobTarget({ x: 10, y: 20 }, 0, 100, lob);
    expect(t.x).toBeCloseTo(110);
    expect(t.y).toBeCloseTo(20);
    expect(t.distance).toBe(100);
  });

  it('clamps to the minimum and maximum range', () => {
    expect(lobTarget({ x: 0, y: 0 }, Math.PI / 2, 5, lob).distance).toBe(48);
    const far = lobTarget({ x: 0, y: 0 }, Math.PI / 2, 999, lob);
    expect(far.distance).toBe(220);
    expect(far.y).toBeCloseTo(220);
  });

  it('defaults to full range without a distance', () => {
    expect(lobTarget({ x: 0, y: 0 }, 0, null, lob).distance).toBe(220);
  });
});

describe('flightTime', () => {
  it('is ground distance over speed, never zero', () => {
    expect(flightTime(150, 150)).toBe(1);
    expect(flightTime(0, 150)).toBeGreaterThan(0);
  });
});

describe('arcHeight', () => {
  it('rises to the apex halfway and is zero at both ends', () => {
    expect(arcHeight(0, 40)).toBe(0);
    expect(arcHeight(1, 40)).toBe(0);
    expect(arcHeight(0.5, 40)).toBe(40);
    expect(arcHeight(0.25, 40)).toBeCloseTo(30);
  });

  it('clamps progress to 0..1', () => {
    expect(arcHeight(1.5, 40)).toBe(0);
  });
});

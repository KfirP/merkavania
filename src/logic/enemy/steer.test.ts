import { describe, expect, it } from 'vitest';
import { clampToArc, steerToward } from './steer';

describe('steerToward', () => {
  it('drives straight at a point ahead', () => {
    expect(steerToward(0, { x: 0, y: 0 }, { x: 100, y: 0 }, 8)).toEqual({ throttle: 1, turn: 0 });
  });

  it('turns toward a point to the side while still rolling', () => {
    const s = steerToward(0, { x: 0, y: 0 }, { x: 100, y: 60 }, 8);
    expect(s.turn).toBeGreaterThan(0);
    expect(s.throttle).toBeGreaterThan(0);
  });

  it('pivots in place toward a point behind it', () => {
    const s = steerToward(0, { x: 0, y: 0 }, { x: -100, y: -10 }, 8);
    expect(s.throttle).toBe(0);
    expect(s.turn).toBe(-1);
  });

  it('stops on arrival', () => {
    expect(steerToward(0, { x: 0, y: 0 }, { x: 5, y: 0 }, 8)).toEqual({ throttle: 0, turn: 0 });
  });
});

describe('clampToArc', () => {
  it('passes angles inside the arc through', () => {
    expect(clampToArc(0.5, 0, 1)).toBeCloseTo(0.5);
  });

  it('clamps to the nearer edge outside it', () => {
    expect(clampToArc(2, 0, 1)).toBeCloseTo(1);
    expect(clampToArc(-2, 0, 1)).toBeCloseTo(-1);
  });

  it('works across ±π', () => {
    expect(clampToArc(Math.PI - 0.2, -Math.PI + 0.1, 0.5)).toBeCloseTo(Math.PI - 0.2);
    expect(clampToArc(0.1, Math.PI, 0.5)).toBeCloseTo(Math.PI - 0.5);
  });
});

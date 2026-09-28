import { describe, expect, it } from 'vitest';
import {
  angleTo,
  applyRadialDeadzone,
  clamp,
  stickAngle,
  stickMagnitude,
  wrapAngle,
} from './stick';

describe('stickAngle', () => {
  it('uses screen space: down is +π/2', () => {
    expect(stickAngle(1, 0)).toBeCloseTo(0);
    expect(stickAngle(0, 1)).toBeCloseTo(Math.PI / 2);
    expect(stickAngle(-1, 0)).toBeCloseTo(Math.PI);
  });
});

describe('clamp', () => {
  it('limits to the range', () => {
    expect(clamp(5, -1, 1)).toBe(1);
    expect(clamp(-5, -1, 1)).toBe(-1);
    expect(clamp(0.3, -1, 1)).toBe(0.3);
  });
});

describe('applyRadialDeadzone', () => {
  it('zeroes input inside the deadzone', () => {
    expect(applyRadialDeadzone(0.1, 0.1, 0.2)).toEqual({ x: 0, y: 0 });
  });

  it('rescales so full deflection stays at 1 and the edge starts at 0', () => {
    const full = applyRadialDeadzone(1, 0, 0.2);
    expect(full.x).toBeCloseTo(1);
    const edge = applyRadialDeadzone(0.21, 0, 0.2);
    expect(edge.x).toBeCloseTo(0.0125);
  });

  it('keeps the direction', () => {
    const v = applyRadialDeadzone(-0.6, 0.8, 0.2);
    expect(Math.atan2(v.y, v.x)).toBeCloseTo(Math.atan2(0.8, -0.6));
  });
});

describe('stickMagnitude', () => {
  it('clamps diagonal overshoot to 1', () => {
    expect(stickMagnitude(1, 1)).toBe(1);
  });
});

describe('angleTo', () => {
  it('points south when the target is below (screen y down)', () => {
    expect(angleTo(0, 0, 0, 10)).toBeCloseTo(Math.PI / 2);
  });
});

describe('wrapAngle', () => {
  it('wraps into (-π, π]', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle((-3 * Math.PI) / 2)).toBeCloseTo(Math.PI / 2);
    expect(wrapAngle(0.5)).toBeCloseTo(0.5);
  });
});

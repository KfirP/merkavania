import { describe, expect, it } from 'vitest';
import { distanceToRect, splashFalloff } from './splash';

describe('splashFalloff', () => {
  it('is full at the centre and fades linearly to zero at the radius', () => {
    expect(splashFalloff(0, 20)).toBe(1);
    expect(splashFalloff(10, 20)).toBeCloseTo(0.5);
    expect(splashFalloff(20, 20)).toBe(0);
    expect(splashFalloff(30, 20)).toBe(0);
  });

  it('is zero for weapons without splash', () => {
    expect(splashFalloff(0, 0)).toBe(0);
  });
});

describe('distanceToRect', () => {
  const rect = { x: 100, y: 100, halfW: 40, halfH: 20 };

  it('is 0 inside the rect and the gap to its nearest edge outside', () => {
    expect(distanceToRect({ x: 130, y: 110 }, rect)).toBe(0);
    expect(distanceToRect({ x: 150, y: 100 }, rect)).toBe(10);
    expect(distanceToRect({ x: 143, y: 124 }, rect)).toBeCloseTo(5);
  });
});

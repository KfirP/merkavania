import { describe, expect, it } from 'vitest';
import { splashFalloff } from './splash';

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

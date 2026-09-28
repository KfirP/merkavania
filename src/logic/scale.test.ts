import { describe, expect, it } from 'vitest';
import { computeZoom } from './scale';

describe('computeZoom', () => {
  it('picks the largest integer zoom that fits', () => {
    expect(computeZoom(1920, 1080)).toBe(4);
    expect(computeZoom(1000, 600)).toBe(2);
    expect(computeZoom(480, 270)).toBe(1);
  });

  it('is limited by the tighter axis', () => {
    expect(computeZoom(3000, 600)).toBe(2);
    expect(computeZoom(1000, 5000)).toBe(2);
  });

  it('falls back to a fractional fit below 1x', () => {
    const zoom = computeZoom(390, 844);
    expect(zoom).toBeLessThan(1);
    expect(zoom).toBeCloseTo(390 / 480);
  });

  it('returns 1 for degenerate sizes', () => {
    expect(computeZoom(0, 0)).toBe(1);
  });
});

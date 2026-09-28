import { describe, expect, it } from 'vitest';
import { ABOVE_DEPTH, depthFor } from './depth';

describe('depthFor', () => {
  it('sorts by y within a level', () => {
    expect(depthFor(0, 100)).toBeLessThan(depthFor(0, 101));
  });

  it('draws any higher-level entity above every lower-level one', () => {
    expect(depthFor(1, 0)).toBeGreaterThan(depthFor(0, 50_000));
  });

  it('keeps the above layer over every level', () => {
    expect(ABOVE_DEPTH).toBeGreaterThan(depthFor(3, 50_000));
  });
});

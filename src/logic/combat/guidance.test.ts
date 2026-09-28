import { describe, expect, it } from 'vitest';
import { steerMissile } from './guidance';

describe('steerMissile', () => {
  it('turns toward the target no faster than its turn rate', () => {
    // Heading east, target due south: wants +π/2 but may only turn 1 rad/s × 0.1 s.
    expect(steerMissile(0, { x: 0, y: 0 }, { x: 0, y: 100 }, 1, 0.1)).toBeCloseTo(0.1);
  });

  it('locks on when the remaining turn is small', () => {
    expect(steerMissile(0, { x: 0, y: 0 }, { x: 100, y: 1 }, 1, 0.1)).toBeCloseTo(
      Math.atan2(1, 100),
    );
  });

  it('flies straight without a target', () => {
    expect(steerMissile(0.3, { x: 0, y: 0 }, null, 1, 0.1)).toBe(0.3);
  });
});

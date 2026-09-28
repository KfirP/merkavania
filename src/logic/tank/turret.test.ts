import { describe, expect, it } from 'vitest';
import { stepTurret } from './turret';

describe('stepTurret', () => {
  it('moves at the traverse rate', () => {
    expect(stepTurret(0, 1, 2, 0.1)).toBeCloseTo(0.2);
  });

  it('snaps to the target instead of overshooting', () => {
    expect(stepTurret(0, 0.1, 2, 0.1)).toBeCloseTo(0.1);
  });

  it('takes the short way across ±π', () => {
    const next = stepTurret(3, -3, 1, 0.1);
    expect(next).toBeCloseTo(3.1);
    // Continuing crosses the seam and lands on the wrapped side.
    let a = 3;
    for (let i = 0; i < 10; i++) a = stepTurret(a, -3, 1, 0.1);
    expect(a).toBeCloseTo(-3);
  });
});

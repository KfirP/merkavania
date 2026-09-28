import { describe, expect, it } from 'vitest';
import { SHAKE } from '../../data/combat';
import { explosionShake, hitShake } from './shake';

describe('hitShake', () => {
  it('grows with damage and is capped', () => {
    expect(hitShake(0)).toBe(0);
    expect(hitShake(10)).toBeCloseTo(10 * SHAKE.perDamage);
    expect(hitShake(1e6)).toBe(SHAKE.maxIntensity);
  });
});

describe('explosionShake', () => {
  it('is strongest at the camera and fades to zero at the range', () => {
    expect(explosionShake(0, 1)).toBeCloseTo(SHAKE.explosionIntensity);
    expect(explosionShake(SHAKE.explosionRange / 2, 1)).toBeCloseTo(SHAKE.explosionIntensity / 2);
    expect(explosionShake(SHAKE.explosionRange, 1)).toBe(0);
  });

  it('scales with the blast size and stays under the cap', () => {
    expect(explosionShake(0, 0.5)).toBeCloseTo(SHAKE.explosionIntensity / 2);
    expect(explosionShake(0, 100)).toBe(SHAKE.maxIntensity);
  });
});

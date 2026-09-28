import { describe, expect, it } from 'vitest';
import { applyDamage } from './health';

describe('applyDamage', () => {
  it('subtracts damage', () => {
    expect(applyDamage(100, 30)).toEqual({ hp: 70, killed: false });
  });

  it('clamps at zero and reports the kill once', () => {
    expect(applyDamage(10, 30)).toEqual({ hp: 0, killed: true });
    expect(applyDamage(0, 30)).toEqual({ hp: 0, killed: false });
  });

  it('ignores zero and negative damage', () => {
    expect(applyDamage(50, 0)).toEqual({ hp: 50, killed: false });
    expect(applyDamage(50, -5)).toEqual({ hp: 50, killed: false });
  });
});

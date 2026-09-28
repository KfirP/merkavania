import { describe, expect, it } from 'vitest';
import { CRUSH_SPEED } from '../../data/combat';
import { crushes } from './crush';

describe('crushes', () => {
  it('a moving tank flattens soldiers', () => {
    expect(crushes('infantry', CRUSH_SPEED)).toBe(true);
    expect(crushes('missile_team', -CRUSH_SPEED * 2)).toBe(true);
  });

  it('a parked or creeping tank just bumps them', () => {
    expect(crushes('infantry', CRUSH_SPEED - 1)).toBe(false);
  });

  it('vehicles and bunkers are never crushed', () => {
    for (const b of ['raider', 'armor', 'static'] as const) expect(crushes(b, 1000)).toBe(false);
  });
});

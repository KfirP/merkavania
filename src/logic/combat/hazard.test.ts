import { describe, expect, it } from 'vitest';
import { terrains } from '../../data/terrain';
import type { Cell } from '../world/grid';
import { hazardDamage } from './hazard';

const cell = (terrain: string | null): Cell => ({
  level: 0,
  ramp: null,
  steep: false,
  terrain,
  solid: false,
});

describe('hazardDamage', () => {
  it('hurts on hazard terrain without the ability', () => {
    expect(hazardDamage(cell('minefield'), [], 0.5)).toBeCloseTo(
      terrains.minefield.hazardDps! * 0.5,
    );
    expect(hazardDamage(cell('missile_zone'), [], 1)).toBeGreaterThan(0);
  });

  it('is harmless with the ability', () => {
    expect(hazardDamage(cell('minefield'), ['mine_plow'], 1)).toBe(0);
    expect(hazardDamage(cell('missile_zone'), ['trophy'], 1)).toBe(0);
  });

  it('is harmless on normal, unknown or missing terrain', () => {
    expect(hazardDamage(cell('sand'), [], 1)).toBe(0);
    expect(hazardDamage(cell('lava'), [], 1)).toBe(0);
    expect(hazardDamage(cell(null), [], 1)).toBe(0);
    expect(hazardDamage(null, [], 1)).toBe(0);
  });
});

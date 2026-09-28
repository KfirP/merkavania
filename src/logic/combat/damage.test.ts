import { describe, expect, it } from 'vitest';
import { REAR_ARC, REAR_MULTIPLIER, armorMultipliers } from '../../data/combat';
import { materials } from '../../data/materials';
import { weapons } from '../../data/weapons';
import { damageMaterial, isRearHit, resolveHit } from './damage';

describe('isRearHit', () => {
  it('is a rear hit when the shot travels the way the target faces', () => {
    expect(isRearHit(0, 0)).toBe(true);
    expect(isRearHit(Math.PI / 2, Math.PI / 2 + 0.1)).toBe(true);
  });

  it('is not a rear hit from the front or the side', () => {
    expect(isRearHit(0, Math.PI)).toBe(false);
    expect(isRearHit(0, Math.PI / 2)).toBe(false);
  });

  it('includes the arc boundary and wraps across ±π', () => {
    expect(isRearHit(0, REAR_ARC)).toBe(true);
    expect(isRearHit(0, REAR_ARC + 0.01)).toBe(false);
    expect(isRearHit(Math.PI - 0.1, -Math.PI + 0.1)).toBe(true);
  });
});

describe('resolveHit', () => {
  const gun = weapons.gun_105;

  it('scales weapon damage by the armor multiplier for its class', () => {
    const hit = resolveHit(gun, { armor: 'low' }, 0);
    expect(hit.damage).toBeCloseTo(gun.damage * armorMultipliers.low.cannon);
    expect(hit.rear).toBe(false);
  });

  it('adds the rear-arc bonus only for targets with a heading', () => {
    const front = resolveHit(gun, { armor: 'low', heading: 0 }, Math.PI);
    const rear = resolveHit(gun, { armor: 'low', heading: 0 }, 0);
    expect(rear.rear).toBe(true);
    expect(rear.damage).toBeCloseTo(front.damage * REAR_MULTIPLIER);
    expect(resolveHit(gun, { armor: 'low' }, 0).rear).toBe(false);
  });

  it('small arms ricochet off vehicle armor but hurt infantry', () => {
    const mg = weapons.coax_mg;
    expect(resolveHit(mg, { armor: 'fortified' }, 0).ricochet).toBe(true);
    const soft = resolveHit(mg, { armor: 'none' }, 0);
    expect(soft.ricochet).toBe(false);
    expect(soft.damage).toBe(mg.damage);
  });
});

describe('damageMaterial', () => {
  it('any weapon damages sandbag and wood', () => {
    for (const w of [weapons.coax_mg, weapons.gun_105]) {
      expect(damageMaterial(w, materials.sandbag)).toEqual({ damage: w.damage, ricochet: false });
      expect(damageMaterial(w, materials.wood).damage).toBe(w.damage);
    }
  });

  it('standard ammo bounces off concrete and armored', () => {
    for (const m of [materials.concrete, materials.armored])
      expect(damageMaterial(weapons.gun_105, m)).toEqual({ damage: 0, ricochet: true });
  });

  it('HEAT breaks concrete but not armored; APFSDS breaks both', () => {
    const heat = { ...weapons.gun_105, ammo: 'heat' as const };
    const apfsds = { ...weapons.gun_105, ammo: 'apfsds' as const };
    expect(damageMaterial(heat, materials.concrete).damage).toBeGreaterThan(0);
    expect(damageMaterial(heat, materials.armored).damage).toBe(0);
    expect(damageMaterial(apfsds, materials.armored).damage).toBeGreaterThan(0);
  });
});

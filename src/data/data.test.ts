import { describe, expect, it } from 'vitest';
import { assetManifest, getAsset, type AssetKey } from './assetManifest';
import { mkTiers } from './mkTiers';
import { QUICK_ROUND_REFILL_SECONDS, weapons } from './weapons';

const keys: string[] = assetManifest.map((a) => a.key);

describe('assetManifest', () => {
  it('has unique keys', () => {
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('uses public/-relative paths', () => {
    for (const a of assetManifest) expect(a.path.startsWith('/')).toBe(false);
  });

  it('keeps origins inside the sprite', () => {
    for (const a of assetManifest) {
      if (!('origin' in a)) continue;
      for (const v of [a.origin.x, a.origin.y]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('getAsset throws on an unknown key', () => {
    expect(() => getAsset('nope' as AssetKey)).toThrow('nope');
  });
});

describe('weapons', () => {
  it('reference existing projectile sprites and have sane numbers', () => {
    for (const w of Object.values(weapons)) {
      expect(keys).toContain(w.projectile);
      expect(w.speed).toBeGreaterThan(0);
      expect(w.range).toBeGreaterThan(0);
      expect(w.spread).toBeGreaterThanOrEqual(0);
    }
  });

  it('coax MG is automatic', () => {
    expect(weapons.coax_mg.interval).toBeGreaterThan(0);
  });

  it('refills quick rounds at 3 s per round (GAME_DESIGN.md)', () => {
    expect(QUICK_ROUND_REFILL_SECONDS).toBe(3);
  });
});

describe('mkTiers', () => {
  it('mk2 matches GAME_DESIGN.md: HP 100, 105mm, 6 quick rounds', () => {
    expect(mkTiers.mk2.hp).toBe(100);
    expect(mkTiers.mk2.mainGun).toBe('gun_105');
    expect(mkTiers.mk2.quickRounds).toBe(6);
  });

  it('reference existing sprites and weapons', () => {
    for (const tier of Object.values(mkTiers)) {
      expect(keys).toContain(tier.sprites.hull);
      expect(keys).toContain(tier.sprites.turret);
      expect(weapons[tier.mainGun]).toBeDefined();
    }
  });

  it('have sane handling', () => {
    for (const { hull, traverseRate, bodyRadius, gunCooldown } of Object.values(mkTiers)) {
      expect(hull.reverseSpeed).toBeLessThan(hull.maxSpeed);
      expect(hull.brake).toBeGreaterThanOrEqual(hull.accel);
      for (const v of [hull.accel, hull.drag, hull.turnRate, traverseRate, gunCooldown])
        expect(v).toBeGreaterThan(0);
      // Must fit the 3-tile (48px) corridors LEVEL_DESIGN.md promises.
      expect(bodyRadius * 2).toBeLessThan(48);
    }
  });
});

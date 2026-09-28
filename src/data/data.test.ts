import { describe, expect, it } from 'vitest';
import { abilityIds } from './abilities';
import { assetManifest, getAsset, type AssetKey } from './assetManifest';
import { ammoTypes, armorIds, armorMultipliers, REAR_ARC, weaponClasses } from './combat';
import { materialIds, materials } from './materials';
import { allMkTierIds, mkTiers } from './mkTiers';
import { terrains } from './terrain';
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

  it('have a known class and ammo, and sane combat numbers', () => {
    for (const w of Object.values(weapons)) {
      expect(weaponClasses).toContain(w.class);
      expect(ammoTypes).toContain(w.ammo);
      expect(w.damage).toBeGreaterThan(0);
      expect(w.splash ?? 0).toBeGreaterThanOrEqual(0);
      if (w.homing !== undefined) expect(w.homing).toBeGreaterThan(0);
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

  it('are all listed in allMkTierIds', () => {
    for (const id of Object.keys(mkTiers)) expect(allMkTierIds).toContain(id);
  });

  it('reference existing sprites and weapons', () => {
    for (const tier of Object.values(mkTiers)) {
      expect(keys).toContain(tier.sprites.hull);
      expect(keys).toContain(tier.sprites.turret);
      expect(weapons[tier.mainGun]).toBeDefined();
    }
  });

  it('have a known armor', () => {
    for (const tier of Object.values(mkTiers)) expect(armorIds).toContain(tier.armor);
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

describe('abilities', () => {
  it('match the GAME_DESIGN.md ability table', () => {
    expect([...abilityIds].sort()).toEqual(
      [
        'mortar',
        'hatch_scout',
        'dozer_blade',
        'ammo_heat',
        'snorkel',
        'ammo_apfsds',
        'mine_plow',
        'smoke',
        'wide_tracks',
        'lahat',
        'hatch_drone',
        'suspension',
        'trophy',
      ].sort(),
    );
  });
});

describe('terrain', () => {
  it('has exactly the LEVEL_DESIGN.md terrain ids', () => {
    expect(Object.keys(terrains).sort()).toEqual(
      [
        'sand',
        'rock',
        'road',
        'water_shallow',
        'water_deep',
        'mud',
        'rubble',
        'minefield',
        'crawlspace',
        'chasm',
        'missile_zone',
      ].sort(),
    );
  });

  it('gates terrain with the LEVEL_DESIGN.md abilities and pawns', () => {
    expect(terrains.water_deep.requires).toEqual({ ability: 'snorkel', without: 'block' });
    expect(terrains.mud.requires).toEqual({ ability: 'wide_tracks', without: 'block' });
    expect(terrains.rubble.requires).toEqual({ ability: 'dozer_blade', without: 'block' });
    expect(terrains.minefield.requires).toEqual({ ability: 'mine_plow', without: 'hazard' });
    expect(terrains.missile_zone.requires).toEqual({ ability: 'trophy', without: 'hazard' });
    expect(terrains.crawlspace.pawns).toEqual(['scout']);
    expect(terrains.chasm.pawns).toEqual(['drone']);
  });

  it('references known abilities and has sane speed multipliers', () => {
    for (const t of Object.values(terrains)) {
      if (t.requires) expect(abilityIds).toContain(t.requires.ability);
      expect(t.speedMul).toBeGreaterThan(0);
      expect(t.speedMul).toBeLessThanOrEqual(2);
    }
  });

  it('gives every hazard terrain a damage rate, and only hazards', () => {
    for (const t of Object.values(terrains)) {
      if (t.requires?.without === 'hazard') expect(t.hazardDps).toBeGreaterThan(0);
      else expect(t.hazardDps).toBeUndefined();
    }
  });

  it('makes road faster than sand', () => {
    expect(terrains.road.speedMul).toBeGreaterThan(terrains.sand.speedMul);
  });
});

describe('combat', () => {
  it('has a multiplier in 0..1 for every armor and weapon class', () => {
    for (const armor of armorIds)
      for (const cls of weaponClasses) {
        const m = armorMultipliers[armor][cls];
        expect(m).toBeGreaterThanOrEqual(0);
        expect(m).toBeLessThanOrEqual(1);
      }
  });

  it('unarmored targets take full damage', () => {
    for (const cls of weaponClasses) expect(armorMultipliers.none[cls]).toBe(1);
  });

  it('has a rear arc narrower than a half circle', () => {
    expect(REAR_ARC).toBeGreaterThan(0);
    expect(REAR_ARC).toBeLessThan(Math.PI / 2);
  });
});

describe('materials', () => {
  it('match the GAME_DESIGN.md destructible materials', () => {
    expect([...materialIds].sort()).toEqual(['armored', 'concrete', 'sandbag', 'wood']);
    expect(materials.sandbag.minAmmo).toBe('standard');
    expect(materials.wood.minAmmo).toBe('standard');
    expect(materials.concrete.minAmmo).toBe('heat');
    expect(materials.armored.minAmmo).toBe('apfsds');
  });

  it('have positive HP and existing sprites', () => {
    for (const m of Object.values(materials)) {
      expect(m.hp).toBeGreaterThan(0);
      expect(keys).toContain(m.sprite);
    }
  });
});

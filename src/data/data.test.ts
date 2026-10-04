import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { abilityIds } from './abilities';
import { assetManifest, getAsset, type AssetKey } from './assetManifest';
import { ammoTypes, armorIds, armorMultipliers, REAR_ARC, weaponClasses } from './combat';
import { enemies, enemyBehaviours, enemyIds } from './enemies';
import { materialIds, materials } from './materials';
import { scout } from './pawns';
import { CHUNK_PX_W } from '../logic/world/chunks';
import { allMkTierIds, mkTiers } from './mkTiers';
import { terrains } from './terrain';
import { AMMO_RACK_BONUS, ARMOR_PLATE_HP, secondaries, secondaryIds } from './progression';
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

  it('points every file entry at a file that exists under public/', () => {
    for (const a of assetManifest)
      if (a.path !== '')
        expect(existsSync(new URL(`../../public/${a.path}`, import.meta.url)), a.key).toBe(true);
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

  it('mk3 matches GAME_DESIGN.md: HP 160, armor med, 120mm, 5 quick rounds', () => {
    expect(mkTiers.mk3.hp).toBe(160);
    expect(mkTiers.mk3.armor).toBe('med');
    expect(mkTiers.mk3.mainGun).toBe('gun_120');
    expect(mkTiers.mk3.quickRounds).toBe(5);
  });

  it('mk3 out-guns the mk2: the 120mm hits harder, flies faster and further, fires sooner', () => {
    const [g105, g120] = [weapons.gun_105, weapons.gun_120];
    expect(g120.damage).toBeGreaterThan(g105.damage);
    expect(g120.speed).toBeGreaterThan(g105.speed);
    expect(g120.range).toBeGreaterThan(g105.range);
    expect(mkTiers.mk3.gunCooldown).toBeLessThan(mkTiers.mk2.gunCooldown);
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

describe('enemies', () => {
  it('match the GAME_DESIGN.md desert roster', () => {
    expect([...enemyIds].sort()).toEqual(
      ['atgm_team', 'bunker_mg', 'light_tank', 'rifle_squad', 'technical'].sort(),
    );
    expect(Object.keys(enemies).sort()).toEqual([...enemyIds].sort());
  });

  it('reference existing weapons, sprites, armor and behaviours', () => {
    for (const e of Object.values(enemies)) {
      expect(weapons[e.weapon]).toBeDefined();
      expect(keys).toContain(e.sprites.body);
      if (e.sprites.turret) expect(keys).toContain(e.sprites.turret);
      expect(armorIds).toContain(e.armor);
      expect(enemyBehaviours).toContain(e.behaviour);
    }
  });

  it('have sane numbers', () => {
    for (const e of Object.values(enemies)) {
      expect(e.hp).toBeGreaterThan(0);
      expect(e.count).toBeGreaterThanOrEqual(1);
      expect(e.windup).toBeGreaterThanOrEqual(0);
      expect(e.traverseRate).toBeGreaterThan(0);
      expect(e.fireRange).toBeLessThanOrEqual(e.sightRange);
      expect(e.fireRange).toBeLessThanOrEqual(weapons[e.weapon].range);
      expect(e.bodyRadius * 2).toBeLessThan(48);
      if (e.behaviour === 'static') expect(e.speed).toBe(0);
      else expect(e.speed).toBeGreaterThan(0);
    }
  });

  it('only guided weapons are ATGMs, and the team telegraphs them', () => {
    expect(weapons[enemies.atgm_team.weapon].homing).toBeGreaterThan(0);
    expect(enemies.atgm_team.windup).toBeGreaterThanOrEqual(1);
  });

  it('keeps the mk2 able to outrun a guided missile on the road', () => {
    expect(weapons.atgm.speed).toBeLessThan(mkTiers.mk2.hull.maxSpeed * terrains.road.speedMul);
  });
});

describe('mortar', () => {
  it('lobs between a minimum and its full range, with an arc', () => {
    const lob = weapons.mortar_60.lob!;
    expect(lob).toBeDefined();
    expect(lob.minRange).toBeGreaterThan(0);
    expect(lob.minRange).toBeLessThan(weapons.mortar_60.range);
    expect(lob.apex).toBeGreaterThan(0);
    expect(weapons.mortar_60.splash).toBeGreaterThan(0);
  });

  it('is the only lobbed weapon', () => {
    for (const w of Object.values(weapons)) if (w.id !== 'mortar_60') expect(w.lob).toBeUndefined();
  });
});

describe('progression', () => {
  it('lists the coax first, always unlocked, then ability-gated secondaries', () => {
    expect(secondaryIds[0]).toBe('coax_mg');
    expect(secondaries.coax_mg.ability).toBeUndefined();
    expect(secondaries.mortar.ability).toBe('mortar');
  });

  it('references known weapons and abilities, with limited ammo for gated ones', () => {
    for (const id of secondaryIds) {
      const s = secondaries[id];
      expect(weapons[s.weapon]).toBeDefined();
      if (s.ability) expect(abilityIds).toContain(s.ability);
      if (s.ammo !== undefined) expect(s.ammo).toBeGreaterThan(0);
    }
    expect(secondaries.coax_mg.ammo).toBeUndefined();
  });

  it('gives minor pickups positive bonuses', () => {
    expect(ARMOR_PLATE_HP).toBeGreaterThan(0);
    expect(AMMO_RACK_BONUS).toBeGreaterThan(0);
  });

  it('has a placeholder-or-file sprite for every progression object', () => {
    for (const k of ['pickup', 'depot_pad', 'switch_off', 'switch_on', 'door', 'boulder'])
      expect(keys).toContain(k);
    expect(keys).toContain(weapons.mortar_60.projectile);
    expect(keys).toContain('shadow');
  });
});

describe('scout', () => {
  it('references an existing sprite, weapon and armor', () => {
    expect(keys).toContain(scout.sprite);
    expect(Object.keys(weapons)).toContain(scout.weapon);
    expect(armorIds).toContain(scout.armor);
    expect(weapons[scout.weapon].class).toBe('small_arms');
  });

  it('is a small, fragile, quick infantryman', () => {
    expect(scout.hp).toBeGreaterThan(0);
    expect(scout.hp).toBeLessThan(mkTiers.mk2.hp);
    expect(scout.bodyRadius).toBeGreaterThan(0);
    // Fits a 1-tile crawlspace.
    expect(scout.bodyRadius * 2).toBeLessThan(16);
    expect(scout.speed).toBeGreaterThan(0);
    expect(scout.recallSpeed).toBeGreaterThanOrEqual(scout.speed);
  });

  it('keeps its leash inside one chunk, so the tank never streams out', () => {
    expect(scout.leash).toBeGreaterThan(scout.boardRadius);
    expect(scout.leash).toBeLessThan(CHUNK_PX_W);
  });

  it('boards from outside the tank body, and has a sane hatch timing', () => {
    expect(scout.boardRadius).toBeGreaterThan(mkTiers.mk2.bodyRadius + scout.bodyRadius);
    expect(scout.deploySpeedMax).toBeGreaterThan(0);
    expect(scout.deathCooldown).toBeGreaterThan(0);
  });
});

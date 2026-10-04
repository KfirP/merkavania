import { describe, expect, it } from 'vitest';
import { mkTiers } from '../../data/mkTiers';
import {
  AMMO_RACK_BONUS,
  ARMOR_PLATE_HP,
  REPAIR_KIT_HEAL,
  secondaries,
} from '../../data/progression';
import {
  ammoCapacity,
  collectPickup,
  cycleSecondary,
  grantAbility,
  grantTier,
  hasAbility,
  maxHp,
  newGame,
  repairCapacity,
  spendAmmo,
  unlockedSecondaries,
  useDepot,
  useRepairKit,
  visitChunk,
} from './gameState';

const MORTAR_AMMO = secondaries.mortar.ammo!;

describe('newGame', () => {
  it('starts a Mk2 with no abilities, the coax selected and no depot', () => {
    const s = newGame();
    expect(s.mk).toBe('mk2');
    expect(s.abilities).toEqual([]);
    expect(s.minor).toEqual({ armor_plate: 0, ammo_rack: 0, repair_kit: 0 });
    expect(s.selectedSecondary).toBe('coax_mg');
    expect(s.depot).toBeNull();
    expect(s.flags.toJSON()).toEqual([]);
    expect(s.visitedChunks).toEqual({});
    expect(s.playtimeMs).toBe(0);
    expect(s.repairCharges).toBe(0);
    expect(maxHp(s)).toBe(mkTiers.mk2.hp);
  });
});

describe('collectPickup', () => {
  it('grants an ability once and marks the pickup taken', () => {
    const s = newGame();
    expect(collectPickup(s, { key: 'c:p1', ability: 'dozer_blade' })).toBe(true);
    expect(hasAbility(s, 'dozer_blade')).toBe(true);
    expect(s.flags.has('c:p1')).toBe(true);
    expect(collectPickup(s, { key: 'c:p1', ability: 'dozer_blade' })).toBe(false);
    expect(s.abilities).toEqual(['dozer_blade']);
  });

  it('a mortar pickup comes loaded', () => {
    const s = newGame();
    collectPickup(s, { key: 'c:m', ability: 'mortar' });
    expect(s.secondaryAmmo.mortar).toBe(MORTAR_AMMO);
    expect(unlockedSecondaries(s)).toEqual(['coax_mg', 'mortar']);
  });

  it('armor plates raise max HP', () => {
    const s = newGame();
    collectPickup(s, { key: 'c:a1', minor: 'armor_plate' });
    collectPickup(s, { key: 'c:a2', minor: 'armor_plate' });
    expect(maxHp(s)).toBe(mkTiers.mk2.hp + 2 * ARMOR_PLATE_HP);
  });

  it('ammo racks raise capacity and add the extra rounds', () => {
    const s = newGame();
    collectPickup(s, { key: 'c:m', ability: 'mortar' });
    collectPickup(s, { key: 'c:r', minor: 'ammo_rack' });
    expect(ammoCapacity(s, 'mortar')).toBe(MORTAR_AMMO + AMMO_RACK_BONUS);
    expect(s.secondaryAmmo.mortar).toBe(MORTAR_AMMO + AMMO_RACK_BONUS);
  });

  it('counts repair kits, and a new kit comes charged', () => {
    const s = newGame();
    collectPickup(s, { key: 'c:k', minor: 'repair_kit' });
    expect(s.minor.repair_kit).toBe(1);
    expect(repairCapacity(s)).toBe(1);
    expect(s.repairCharges).toBe(1);
  });
});

describe('secondaries', () => {
  it('the coax is unlimited', () => {
    const s = newGame();
    expect(ammoCapacity(s, 'coax_mg')).toBeNull();
    expect(spendAmmo(s, 'coax_mg')).toBe(true);
  });

  it('cycling skips locked secondaries', () => {
    const s = newGame();
    cycleSecondary(s, 1);
    expect(s.selectedSecondary).toBe('coax_mg');
    collectPickup(s, { key: 'c:m', ability: 'mortar' });
    cycleSecondary(s, 1);
    expect(s.selectedSecondary).toBe('mortar');
    cycleSecondary(s, 1);
    expect(s.selectedSecondary).toBe('coax_mg');
    cycleSecondary(s, -1);
    expect(s.selectedSecondary).toBe('mortar');
  });

  it('spends limited ammo until empty', () => {
    const s = newGame();
    expect(spendAmmo(s, 'mortar')).toBe(false); // not owned
    collectPickup(s, { key: 'c:m', ability: 'mortar' });
    for (let i = 0; i < MORTAR_AMMO; i++) expect(spendAmmo(s, 'mortar')).toBe(true);
    expect(spendAmmo(s, 'mortar')).toBe(false);
    expect(s.secondaryAmmo.mortar).toBe(0);
  });
});

describe('useRepairKit', () => {
  const withKits = (n: number) => {
    const s = newGame();
    for (let i = 0; i < n; i++) collectPickup(s, { key: `c:k${i}`, minor: 'repair_kit' });
    return s;
  };

  it('spends a charge to heal a share of max HP', () => {
    const s = withKits(2);
    const max = maxHp(s);
    expect(useRepairKit(s, 10, max)).toBe(Math.ceil(max * REPAIR_KIT_HEAL));
    expect(s.repairCharges).toBe(1);
  });

  it('never heals past max HP', () => {
    const s = withKits(1);
    const max = maxHp(s);
    expect(useRepairKit(s, max - 3, max)).toBe(3);
  });

  it('does nothing without a charge, at full HP or when dead', () => {
    const max = maxHp(newGame());
    expect(useRepairKit(newGame(), 10, max)).toBeNull();
    const s = withKits(1);
    expect(useRepairKit(s, max, max)).toBeNull();
    expect(useRepairKit(s, 0, max)).toBeNull();
    expect(s.repairCharges).toBe(1);
  });

  it('heal share is sane', () => {
    expect(REPAIR_KIT_HEAL).toBeGreaterThan(0);
    expect(REPAIR_KIT_HEAL).toBeLessThanOrEqual(1);
  });
});

describe('useDepot', () => {
  it('refills repair kit charges', () => {
    const s = newGame();
    collectPickup(s, { key: 'c:k', minor: 'repair_kit' });
    useRepairKit(s, 1, maxHp(s));
    expect(s.repairCharges).toBe(0);
    useDepot(s, 'a:depot');
    expect(s.repairCharges).toBe(1);
  });

  it('records the depot and refills secondary ammo', () => {
    const s = newGame();
    collectPickup(s, { key: 'c:m', ability: 'mortar' });
    spendAmmo(s, 'mortar');
    useDepot(s, 'test_x00_y02:depot_1');
    expect(s.depot).toBe('test_x00_y02:depot_1');
    expect(s.secondaryAmmo.mortar).toBe(MORTAR_AMMO);
  });
});

describe('visitChunk', () => {
  it('records each chunk once per biome', () => {
    const s = newGame();
    visitChunk(s, 'test', 'test_x00_y00');
    visitChunk(s, 'test', 'test_x00_y00');
    visitChunk(s, 'test', 'test_x01_y00');
    expect(s.visitedChunks).toEqual({ test: ['test_x00_y00', 'test_x01_y00'] });
  });
});

describe('grantAbility', () => {
  it('grants an ability (loaded, if it is a secondary) without any pickup flag', () => {
    const s = newGame();
    grantAbility(s, 'mortar');
    grantAbility(s, 'mortar');
    expect(s.abilities).toEqual(['mortar']);
    expect(s.secondaryAmmo.mortar).toBe(MORTAR_AMMO);
    expect(s.flags.toJSON()).toEqual([]);
  });
});

describe('grantTier', () => {
  it('upgrades the Mk, grants its signature ability and raises max HP', () => {
    const s = newGame();
    expect(grantTier(s, 'mk3')).toBe(true);
    expect(s.mk).toBe('mk3');
    expect(hasAbility(s, 'suspension')).toBe(true);
    expect(maxHp(s)).toBe(mkTiers.mk3.hp);
  });

  it('is idempotent and never downgrades', () => {
    const s = newGame();
    grantTier(s, 'mk3');
    expect(grantTier(s, 'mk3')).toBe(false);
    expect(grantTier(s, 'mk2')).toBe(false);
    expect(s.mk).toBe('mk3');
    expect(s.abilities).toEqual(['suspension']);
  });
});

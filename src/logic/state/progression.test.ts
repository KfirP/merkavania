import { describe, expect, it } from 'vitest';
import { mkTiers } from '../../data/mkTiers';
import { AMMO_RACK_BONUS, ARMOR_PLATE_HP, secondaries } from '../../data/progression';
import {
  ammoCapacity,
  collectPickup,
  cycleSecondary,
  hasAbility,
  maxHp,
  newGame,
  spendAmmo,
  unlockedSecondaries,
  useDepot,
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

  it('counts repair kits', () => {
    const s = newGame();
    collectPickup(s, { key: 'c:k', minor: 'repair_kit' });
    expect(s.minor.repair_kit).toBe(1);
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

describe('useDepot', () => {
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

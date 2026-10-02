import { describe, expect, it } from 'vitest';
import { activates, pawnActivates } from './switches';

describe('activates', () => {
  it('cannon switches take the player main gun, not the coax or enemy fire', () => {
    expect(activates('cannon', 'gun_105', 'player')).toBe(true);
    expect(activates('cannon', 'coax_mg', 'player')).toBe(false);
    expect(activates('cannon', 'gun_light_tank', 'enemy')).toBe(false);
  });

  it('mortar switches take only the player mortar', () => {
    expect(activates('mortar', 'mortar_60', 'player')).toBe(true);
    expect(activates('mortar', 'gun_105', 'player')).toBe(false);
  });

  it('pawn and guided-missile switches never react to fire', () => {
    for (const by of ['scout', 'drone', 'lahat', 'remote'])
      expect(activates(by, 'mortar_60', 'player')).toBe(false);
  });

  it('the scout rifle flips nothing', () => {
    for (const by of ['cannon', 'mortar', 'scout'])
      expect(activates(by, 'rifle_scout', 'player')).toBe(false);
  });
});

describe('pawnActivates', () => {
  it('scout switches flip when the scout walks onto them, and only the scout', () => {
    expect(pawnActivates('scout', 'scout')).toBe(true);
    expect(pawnActivates('scout', 'tank')).toBe(false);
    expect(pawnActivates('scout', 'drone')).toBe(false);
  });

  it('drone switches wait for the drone; fire switches ignore pawns', () => {
    expect(pawnActivates('drone', 'drone')).toBe(true);
    expect(pawnActivates('drone', 'scout')).toBe(false);
    for (const by of ['cannon', 'mortar', 'lahat', 'remote'])
      for (const pawn of ['tank', 'scout', 'drone'] as const)
        expect(pawnActivates(by, pawn)).toBe(false);
  });
});

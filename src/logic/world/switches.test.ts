import { describe, expect, it } from 'vitest';
import { activates } from './switches';

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
});

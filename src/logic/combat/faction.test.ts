import { describe, expect, it } from 'vitest';
import { canHit } from './faction';

describe('canHit', () => {
  it('hits the other faction on the same level', () => {
    expect(canHit({ owner: 'player', level: 1 }, { faction: 'enemy', level: 1 })).toBe(true);
    expect(canHit({ owner: 'enemy', level: 0 }, { faction: 'player', level: 0 })).toBe(true);
  });

  it('never hits its own faction', () => {
    expect(canHit({ owner: 'enemy', level: 0 }, { faction: 'enemy', level: 0 })).toBe(false);
  });

  it('never hits across levels', () => {
    expect(canHit({ owner: 'player', level: 0 }, { faction: 'enemy', level: 1 })).toBe(false);
  });

  it('neutral targets (destructibles) take hits from anyone', () => {
    expect(canHit({ owner: 'player', level: 0 }, { faction: 'neutral', level: 0 })).toBe(true);
    expect(canHit({ owner: 'enemy', level: 0 }, { faction: 'neutral', level: 0 })).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { initialGun, tickGun, tryFire, type MainGunState, type MainGunStats } from './mainGun';

const mk2: MainGunStats = { quickRounds: 6, cooldown: 0.5, refillPerRound: 3 };

// One extra frame absorbs float residue from summing 1/60 steps.
const FRAME = 1 / 60;

function tick(state: MainGunState, seconds: number): MainGunState {
  for (let i = 0; i < Math.round(seconds / FRAME); i++) state = tickGun(state, mk2, FRAME);
  return state;
}

function emptyGun(): MainGunState {
  let s = initialGun(mk2);
  for (let i = 0; i < mk2.quickRounds; i++) {
    const r = tryFire(s, mk2);
    expect(r.fired).toBe(true);
    s = tick(r.state, mk2.cooldown + FRAME);
  }
  return s;
}

describe('main gun quick rounds', () => {
  it('enforces the cooldown between shots', () => {
    const first = tryFire(initialGun(mk2), mk2);
    expect(first.fired).toBe(true);
    expect(tryFire(first.state, mk2).fired).toBe(false);
    expect(tryFire(tick(first.state, 0.5 + FRAME), mk2).fired).toBe(true);
  });

  it('starts an 18 s refill for Mk2 when the last round is fired', () => {
    const s = emptyGun();
    expect(s.rounds).toBe(0);
    expect(s.refill).toBeCloseTo(18 - mk2.cooldown - FRAME, 1);
    expect(tryFire(s, mk2).fired).toBe(false);
  });

  it('restores all rounds when the refill ends', () => {
    const s = tick(emptyGun(), 18);
    expect(s).toEqual({ rounds: 6, cooldown: 0, refill: 0 });
    expect(tryFire(s, mk2).fired).toBe(true);
  });

  it('does not refill partially used rounds', () => {
    const s = tick(tryFire(initialGun(mk2), mk2).state, 60);
    expect(s.rounds).toBe(5);
  });
});

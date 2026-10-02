import { describe, expect, it } from 'vitest';
import { closestAlive, pickTarget } from './target';

const tank = { pos: { x: 100, y: 0 }, level: 0, alive: true };
const scout = { pos: { x: 40, y: 0 }, level: 0, alive: true };
const self = { x: 0, y: 0 };
const clear = () => true;

describe('pickTarget', () => {
  it('chases the closest pawn it can see', () => {
    expect(pickTarget(self, 0, [tank, scout], 200, clear)).toEqual({
      target: scout,
      visible: true,
    });
  });

  it('skips pawns on another level, out of range or behind walls', () => {
    const high = { ...scout, level: 1 };
    expect(pickTarget(self, 0, [tank, high], 200, clear).target).toBe(tank);
    expect(pickTarget(self, 0, [tank, scout], 60, clear).target).toBe(scout);
    const blocked = (_from: unknown, to: { x: number }) => to.x !== 40;
    expect(pickTarget(self, 0, [tank, scout], 200, blocked)).toEqual({
      target: tank,
      visible: true,
    });
  });

  it('keeps tracking the closest living pawn, unseen, when none is visible', () => {
    expect(pickTarget(self, 0, [tank, scout], 10, clear)).toEqual({
      target: scout,
      visible: false,
    });
  });

  it('has no target when every pawn is dead', () => {
    expect(pickTarget(self, 0, [{ ...tank, alive: false }], 200, clear)).toEqual({
      target: null,
      visible: false,
    });
  });
});

describe('closestAlive', () => {
  it('picks the nearest living pawn (missile homing)', () => {
    expect(closestAlive({ x: 90, y: 0 }, [tank, scout])).toBe(tank);
    expect(closestAlive({ x: 90, y: 0 }, [{ ...tank, alive: false }, scout])).toBe(scout);
    expect(closestAlive(self, [])).toBeNull();
  });
});

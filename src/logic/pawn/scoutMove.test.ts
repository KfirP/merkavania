import { describe, expect, it } from 'vitest';
import { clampLeash, limitToLeash, scoutVelocity } from './scoutMove';

describe('scoutVelocity', () => {
  it('stands still with no input', () => {
    expect(scoutVelocity(0, 0, 70)).toEqual({ vx: 0, vy: 0 });
  });

  it('walks screen-up on throttle and right on turn (8-way, not tank controls)', () => {
    expect(scoutVelocity(1, 0, 70)).toEqual({ vx: 0, vy: -70 });
    expect(scoutVelocity(-1, 0, 70)).toEqual({ vx: 0, vy: 70 });
    expect(scoutVelocity(0, 1, 70)).toEqual({ vx: 70, vy: 0 });
    expect(scoutVelocity(0, -1, 70)).toEqual({ vx: -70, vy: 0 });
  });

  it('is no faster on a diagonal', () => {
    const v = scoutVelocity(1, 1, 70);
    expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(70);
    expect(v.vx).toBeCloseTo(-v.vy);
  });

  it('keeps a half-tilted stick slow', () => {
    expect(scoutVelocity(0.5, 0, 70).vy).toBeCloseTo(-35);
  });
});

describe('limitToLeash', () => {
  const anchor = { x: 0, y: 0 };

  it('leaves motion alone inside the leash', () => {
    expect(limitToLeash({ x: 100, y: 0 }, { vx: 50, vy: 10 }, anchor, 400)).toEqual({
      vx: 50,
      vy: 10,
    });
  });

  it('drops the outward part at the end of the leash but keeps sliding along it', () => {
    const v = limitToLeash({ x: 400, y: 0 }, { vx: 50, vy: 30 }, anchor, 400);
    expect(v.vx).toBeCloseTo(0);
    expect(v.vy).toBeCloseTo(30);
  });

  it('lets the scout walk back in', () => {
    expect(limitToLeash({ x: 400, y: 0 }, { vx: -50, vy: 0 }, anchor, 400)).toEqual({
      vx: -50,
      vy: 0,
    });
  });
});

describe('clampLeash', () => {
  it('pulls a point beyond the leash back onto it', () => {
    const p = clampLeash({ x: 0, y: 500 }, { x: 0, y: 0 }, 400);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(400);
  });

  it('keeps a point inside', () => {
    expect(clampLeash({ x: 10, y: 20 }, { x: 0, y: 0 }, 400)).toEqual({ x: 10, y: 20 });
  });
});

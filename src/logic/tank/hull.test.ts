import { describe, expect, it } from 'vitest';
import { speedAfterImpact, stepHull, type HullState, type HullStats } from './hull';

describe('speedAfterImpact', () => {
  it('drops to zero when a wall stopped the tank head-on', () => {
    expect(speedAfterImpact(70, 0, 0, 0)).toBe(0);
  });

  it('keeps only the motion along the heading when sliding along a wall', () => {
    // Heading 45°, the wall zeroed y: the surviving x velocity projects back onto the heading.
    const h = Math.PI / 4;
    expect(speedAfterImpact(70, h, 70 * Math.cos(h), 0)).toBeCloseTo(35);
  });

  it('never adds speed', () => {
    expect(speedAfterImpact(10, 0, 50, 0)).toBe(10);
  });

  it('works while reversing', () => {
    expect(speedAfterImpact(-40, 0, 0, 0)).toBe(0);
    expect(speedAfterImpact(-40, 0, -20, 0)).toBe(-20);
  });
});

const stats: HullStats = {
  maxSpeed: 100,
  reverseSpeed: 50,
  accel: 50,
  brake: 200,
  drag: 100,
  turnRate: 2,
};

function run(state: HullState, throttle: number, turn: number, seconds: number): HullState {
  const dt = 1 / 60;
  for (let i = 0; i < Math.round(seconds / dt); i++)
    state = stepHull(state, throttle, turn, stats, dt);
  return state;
}

describe('stepHull', () => {
  it('builds speed gradually and caps at top speed', () => {
    const after1s = run({ heading: 0, speed: 0 }, 1, 0, 1);
    expect(after1s.speed).toBeCloseTo(50);
    expect(run(after1s, 1, 0, 5).speed).toBe(100);
  });

  it('coasts to a stop with no throttle, using drag', () => {
    const s = run({ heading: 0, speed: 100 }, 0, 0, 0.5);
    expect(s.speed).toBeCloseTo(50);
    expect(run(s, 0, 0, 1).speed).toBe(0);
  });

  it('brakes hard when throttling against the motion, then reverses slower', () => {
    const braked = run({ heading: 0, speed: 100 }, -1, 0, 0.5);
    expect(braked.speed).toBeCloseTo(0, 0);
    expect(run(braked, -1, 0, 5).speed).toBe(-50);
  });

  it('eases off with drag when throttle is reduced in the same direction', () => {
    const s = run({ heading: 0, speed: 100 }, 0.5, 0, 0.25);
    expect(s.speed).toBeCloseTo(75);
  });

  it('pivots in place', () => {
    const s = run({ heading: 0, speed: 0 }, 0, 1, 0.5);
    expect(s.heading).toBeCloseTo(1);
    expect(s.speed).toBe(0);
  });

  it('keeps heading wrapped', () => {
    const s = run({ heading: 3, speed: 0 }, 0, 1, 0.5);
    expect(s.heading).toBeCloseTo(4 - 2 * Math.PI);
  });
});

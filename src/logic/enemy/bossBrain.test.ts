import { describe, expect, it } from 'vitest';
import { bosses } from '../../data/bosses';
import {
  initialBoss,
  projectOnRail,
  railLength,
  railPoint,
  stepBoss,
  type BossInput,
  type BossState,
} from './bossBrain';

const def = bosses.boss_desert;
const rail = [
  { x: 0, y: 100 },
  { x: 200, y: 100 },
  { x: 200, y: 200 },
];

describe('rail geometry', () => {
  it('measures, walks and projects onto a polyline', () => {
    expect(railLength(rail)).toBe(300);
    expect(railPoint(rail, 50)).toEqual({ x: 50, y: 100 });
    expect(railPoint(rail, 250)).toEqual({ x: 200, y: 150 });
    expect(railPoint(rail, 999)).toEqual({ x: 200, y: 200 });
    expect(projectOnRail(rail, { x: 80, y: 40 })).toBeCloseTo(80);
    expect(projectOnRail(rail, { x: 260, y: 170 })).toBeCloseTo(270);
  });
});

/** Steps the brain `seconds` in small frames with the same input, collecting what it asked for. */
function run(s: BossState, seconds: number, input: Partial<BossInput> = {}) {
  const out = { fired: 0, spawned: 0, woke: false, phase2: false, telegraphed: false };
  const full: BossInput = {
    hpShare: 1,
    target: { x: 100, y: 300 },
    inArena: true,
    reinforcementsAlive: 0,
    ...input,
  };
  for (let i = 0; i < Math.round(seconds / 0.05); i++) {
    const intent = stepBoss(s, def, rail, full, 0.05);
    out.fired += intent.fire ? 1 : 0;
    out.spawned += intent.spawn ? 1 : 0;
    out.woke ||= intent.woke;
    out.phase2 ||= intent.enteredPhase2;
    out.telegraphed ||= s.telegraphing;
  }
  return out;
}

describe('stepBoss', () => {
  it('sleeps until the player enters the arena, then wakes', () => {
    const s = initialBoss(rail);
    expect(run(s, 2, { inArena: false })).toMatchObject({ woke: false, fired: 0 });
    expect(s.mode).toBe('dormant');
    expect(run(s, 0.1).woke).toBe(true);
    expect(s.mode).toBe('intro');
  });

  it('holds fire through the intro, then telegraphs before every shot', () => {
    const s = initialBoss(rail);
    run(s, def.intro - 0.2);
    expect(s.mode).toBe('intro');
    expect(run(s, def.gun.telegraph).fired).toBe(0);
    const first = run(s, def.gun.telegraph);
    expect(first.telegraphed).toBe(true);
    expect(first.fired).toBe(1);
  });

  it('fires once per interval in phase 1, faster in phase 2', () => {
    const s = initialBoss(rail);
    run(s, def.intro + def.gun.telegraph + 0.1);
    const span = def.gun.interval * 4;
    const calm = run(s, span).fired;
    expect(calm).toBeGreaterThanOrEqual(3);
    expect(calm).toBeLessThanOrEqual(5);
    const angry = run(s, span, { hpShare: def.phase2.at - 0.01 });
    expect(angry.phase2).toBe(true);
    expect(angry.fired).toBeGreaterThan(calm);
  });

  it('slides along the rail toward the target at its rail speed', () => {
    const s = initialBoss(rail);
    run(s, def.intro + 0.1);
    const before = s.railPos;
    run(s, 1, { target: { x: 10, y: 0 } });
    expect(before - s.railPos).toBeCloseTo(def.gun.railSpeed, 0);
    run(s, 10, { target: { x: 10, y: 0 } });
    expect(s.railPos).toBeCloseTo(10, 0);
  });

  it('turns its gun toward the target', () => {
    const s = initialBoss(rail);
    // Nearest the first rail segment, straight below the gun's spot on it.
    run(s, def.intro + 5, { target: { x: 100, y: 130 } });
    expect(s.aim).toBeCloseTo(Math.PI / 2, 1);
  });

  it('calls reinforcements in phase 2 only, up to the cap', () => {
    const s = initialBoss(rail);
    run(s, def.intro + 0.1);
    const { every, max } = def.phase2.reinforcements;
    expect(run(s, every * 2).spawned).toBe(0);
    expect(run(s, every * 1.1, { hpShare: 0.2 }).spawned).toBeGreaterThanOrEqual(1);
    expect(run(s, every * 3, { hpShare: 0.2, reinforcementsAlive: max }).spawned).toBe(0);
  });

  it('holds fire with no target, and stops for good once dead', () => {
    const s = initialBoss(rail);
    run(s, def.intro + 0.1);
    expect(run(s, 10, { target: null }).fired).toBe(0);
    s.mode = 'dead';
    expect(run(s, 10)).toMatchObject({ fired: 0, spawned: 0 });
  });
});

import { describe, expect, it } from 'vitest';
import {
  board,
  deployPoint,
  deployRefusal,
  initialHatch,
  stepHatch,
  type HatchInput,
  type HatchState,
} from './hatch';

const ok = { has: true, alive: true, speed: 0, maxSpeed: 5, cooldown: 0, spotOk: true };

describe('deployPoint', () => {
  it('is just behind the hull, clear of both bodies', () => {
    // Facing east: the rear is west.
    const p = deployPoint({ x: 100, y: 50 }, 0, 13, 4);
    expect(p.x).toBeCloseTo(100 - (13 + 4 + 2));
    expect(p.y).toBeCloseTo(50);
    // Facing north: the rear is south (y down).
    const q = deployPoint({ x: 100, y: 50 }, -Math.PI / 2, 13, 4);
    expect(q.x).toBeCloseTo(100);
    expect(q.y).toBeCloseTo(50 + 19);
  });
});

describe('deployRefusal', () => {
  it('allows a stopped, living tank with the ability and a free rear', () => {
    expect(deployRefusal(ok)).toBeNull();
  });

  it('names why the hatch stays shut', () => {
    expect(deployRefusal({ ...ok, has: false })).toBe('locked');
    expect(deployRefusal({ ...ok, alive: false })).toBe('dead');
    expect(deployRefusal({ ...ok, speed: 20 })).toBe('moving');
    expect(deployRefusal({ ...ok, speed: -20 })).toBe('moving');
    expect(deployRefusal({ ...ok, cooldown: 0.5 })).toBe('cooldown');
    expect(deployRefusal({ ...ok, spotOk: false })).toBe('blocked');
  });
});

describe('stepHatch', () => {
  const input = (over: Partial<HatchInput> = {}): HatchInput => ({
    hatch: false,
    canDeploy: true,
    tankAlive: true,
    scoutAlive: true,
    distToTank: 0,
    boardRadius: 20,
    deathCooldown: 1.5,
    dt: 0.016,
    ...over,
  });
  const scoutOut: HatchState = { mode: 'scout', armed: false, cooldown: 0 };

  it('deploys on hatch when allowed', () => {
    const r = stepHatch(initialHatch(), input({ hatch: true }));
    expect(r.action).toBe('deploy');
    expect(r.state.mode).toBe('scout');
    expect(r.state.armed).toBe(false);
  });

  it('stays in the tank when deploying is refused or hatch is not pressed', () => {
    expect(stepHatch(initialHatch(), input({ hatch: true, canDeploy: false })).action).toBe(
      'refused',
    );
    const idle = stepHatch(initialHatch(), input());
    expect(idle.action).toBe('none');
    expect(idle.state.mode).toBe('tank');
  });

  it('does not board the moment it climbs out', () => {
    const r = stepHatch(scoutOut, input({ distToTank: 10 }));
    expect(r.action).toBe('none');
    expect(r.state.mode).toBe('scout');
  });

  it('arms once the scout has walked away, then boards when it walks back', () => {
    const away = stepHatch(scoutOut, input({ distToTank: 40 }));
    expect(away.state.armed).toBe(true);
    const back = stepHatch(away.state, input({ distToTank: 15 }));
    expect(back.action).toBe('board');
    expect(back.state.mode).toBe('tank');
  });

  it('starts a recall on hatch, ignores hatch while recalling, and boards on arrival', () => {
    const r = stepHatch(scoutOut, input({ hatch: true, distToTank: 100 }));
    expect(r.action).toBe('recall');
    expect(r.state.mode).toBe('recall');
    const again = stepHatch(r.state, input({ hatch: true, distToTank: 80 }));
    expect(again.action).toBe('none');
    expect(again.state.mode).toBe('recall');
    // A recall boards even if the scout never left the radius.
    const home = stepHatch({ ...r.state, armed: false }, input({ distToTank: 10 }));
    expect(home.action).toBe('board');
  });

  it('a downed scout returns control to the tank with a cooldown that ticks away', () => {
    const r = stepHatch(scoutOut, input({ scoutAlive: false, distToTank: 100 }));
    expect(r.action).toBe('lost');
    expect(r.state).toEqual({ mode: 'tank', armed: false, cooldown: 1.5 });
    const later = stepHatch(r.state, input({ dt: 1 }));
    expect(later.state.cooldown).toBeCloseTo(0.5);
  });

  it('drops the scout if the tank dies', () => {
    const r = stepHatch(scoutOut, input({ tankAlive: false, distToTank: 100 }));
    expect(r.action).toBe('lost');
    expect(r.state.mode).toBe('tank');
  });

  it('board() forces the scout home (a recall with no path)', () => {
    expect(board({ mode: 'recall', armed: true, cooldown: 0.2 })).toEqual({
      mode: 'tank',
      armed: false,
      cooldown: 0.2,
    });
  });
});

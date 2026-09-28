import { describe, expect, it } from 'vitest';
import { STUCK_RECOVER_TIME, STUCK_TIME } from '../../data/enemies';
import { initialUnstick, stepUnstick, type UnstickState } from './unstick';

function run(state: UnstickState, wants: boolean, speed: number, seconds: number, dt = 0.05) {
  let out = { state, override: null as ReturnType<typeof stepUnstick>['override'] };
  for (let t = 0; t < seconds - 1e-9; t += dt) out = stepUnstick(out.state, wants, speed, dt);
  return out;
}

describe('stepUnstick', () => {
  it('leaves a vehicle that is moving alone', () => {
    expect(run(initialUnstick(), true, 40, STUCK_TIME * 2).override).toBeNull();
  });

  it('leaves a vehicle that is parked on purpose alone', () => {
    expect(run(initialUnstick(), false, 0, STUCK_TIME * 2).override).toBeNull();
  });

  it('backs up and turns after trying to move without getting anywhere', () => {
    const stuck = run(initialUnstick(), true, 0, STUCK_TIME + 0.1);
    expect(stuck.override).toEqual({ throttle: -1, turn: 1 });
  });

  it('recovers for a while, then hands control back', () => {
    const stuck = run(initialUnstick(), true, 0, STUCK_TIME + 0.1);
    const later = run(stuck.state, true, 30, STUCK_RECOVER_TIME + 0.1);
    expect(later.override).toBeNull();
  });

  it('turns the other way the next time it gets stuck, to try both ways round', () => {
    const first = run(initialUnstick(), true, 0, STUCK_TIME + 0.1);
    const freed = run(first.state, true, 30, STUCK_RECOVER_TIME + 0.1);
    const second = run(freed.state, true, 0, STUCK_TIME + 0.1);
    expect(second.override).toEqual({ throttle: -1, turn: -1 });
  });
});

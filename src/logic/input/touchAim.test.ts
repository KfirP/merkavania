import { describe, expect, it } from 'vitest';
import {
  ALIGN_TOLERANCE,
  FIRE_WINDOW,
  TOUCH_AIM_DEADZONE,
  TOUCH_MG_THRESHOLD,
  initialTouchAim,
  stepTouchAim,
  touchAimZone,
  type TouchAimInput,
  type TouchAimState,
} from './touchAim';

const DT = 1 / 60;
const released = { x: 0, y: 0, active: false };
const east = (mag: number) => ({ x: mag, y: 0, active: true });

/** Runs one frame; `turretAngle` defaults to already lined up with east. */
function step(state: TouchAimState, input: Partial<TouchAimInput>) {
  return stepTouchAim(state, {
    right: released,
    mgOn: false,
    turretAngle: 0,
    gunFired: false,
    dt: DT,
    ...input,
  });
}

describe('stepTouchAim: cannon', () => {
  it('aims past the deadzone without firing', () => {
    const r = step(initialTouchAim(), { right: east(0.8), turretAngle: 0 });
    expect(r.aimAngle).toBeCloseTo(0);
    expect(r.fire).toBe(false);
  });

  it('fires once the turret lines up after a release, and only once', () => {
    let s = step(initialTouchAim(), { right: east(0.8), turretAngle: -1 }).state;
    // Released while the turret is still swinging: nothing yet.
    let r = step(s, { turretAngle: -1 });
    expect(r.fire).toBe(false);
    s = r.state;
    // Lined up: fire until the gun reports the shot.
    r = step(s, { turretAngle: -ALIGN_TOLERANCE / 2 });
    expect(r.fire).toBe(true);
    r = step(r.state, { gunFired: true });
    expect(r.fire).toBe(false);
    expect(step(r.state, {}).fire).toBe(false);
  });

  it('cancels when dragged back to the centre before lifting, keeping the aim', () => {
    let s = step(initialTouchAim(), { right: east(0.8) }).state;
    s = step(s, { right: east(TOUCH_AIM_DEADZONE / 2) }).state;
    const r = step(s, {});
    expect(r.fire).toBe(false);
    expect(r.aimAngle).toBeCloseTo(0);
    expect(step(r.state, {}).fire).toBe(false);
  });

  it('never fires on a tap', () => {
    const s = step(initialTouchAim(), { right: east(0) }).state;
    const r = step(s, {});
    expect(r.fire).toBe(false);
    expect(r.aimAngle).toBeNull();
  });

  it('keeps aiming at the released angle so the turret finishes its swing', () => {
    const s = step(initialTouchAim(), { right: { x: 0, y: 1, active: true } }).state;
    const r = step(s, { turretAngle: 0 });
    expect(r.aimAngle).toBeCloseTo(Math.PI / 2);
  });

  it('drops the queued shot if the gun cannot fire within the window (e.g. refilling)', () => {
    let r = step(initialTouchAim(), { right: east(0.8) });
    r = step(r.state, {});
    expect(r.fire).toBe(true);
    for (let t = 0; t < FIRE_WINDOW + 0.1; t += DT) r = step(r.state, {});
    expect(r.fire).toBe(false);
  });

  it('cancels a queued shot when the player drags again', () => {
    let r = step(initialTouchAim(), { right: east(0.8), turretAngle: -2 });
    r = step(r.state, { turretAngle: -2 }); // released, queued, not lined up
    r = step(r.state, { right: { x: 0, y: -0.8, active: true }, turretAngle: 0 });
    expect(r.fire).toBe(false);
    expect(r.aimAngle).toBeCloseTo(-Math.PI / 2);
  });
});

describe('stepTouchAim: coax MG', () => {
  it('with MG mode on, aims without firing between the rings and fires past the outer one', () => {
    const between = (TOUCH_AIM_DEADZONE + TOUCH_MG_THRESHOLD) / 2;
    let r = step(initialTouchAim(), { right: east(between), mgOn: true });
    expect(r.altFire).toBe(false);
    expect(r.aimAngle).toBeCloseTo(0);
    r = step(r.state, { right: east(1), mgOn: true });
    expect(r.altFire).toBe(true);
    expect(r.fire).toBe(false);
    // Pulling back inside the ring stops the MG.
    r = step(r.state, { right: east(between), mgOn: true });
    expect(r.altFire).toBe(false);
  });

  it('still fires the cannon on release with MG mode on', () => {
    let r = step(initialTouchAim(), { right: east(1), mgOn: true });
    r = step(r.state, { mgOn: true });
    expect(r.altFire).toBe(false);
    expect(r.fire).toBe(true);
  });

  it('never fires the MG with MG mode off', () => {
    expect(step(initialTouchAim(), { right: east(1), mgOn: false }).altFire).toBe(false);
  });
});

describe('touchAimZone', () => {
  it('splits the stick into cancel, armed and (with MG mode on) MG rings', () => {
    expect(touchAimZone(TOUCH_AIM_DEADZONE, true)).toBe('cancel');
    expect(touchAimZone(0.5, true)).toBe('armed');
    expect(touchAimZone(0.9, true)).toBe('mg');
    expect(touchAimZone(0.9, false)).toBe('armed');
  });
});

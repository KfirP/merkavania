import { describe, expect, it } from 'vitest';
import {
  keyAxis,
  mouseButtons,
  PAD_AIM_DEADZONE,
  padAnalog,
  padLobDistance,
  touchMove,
} from './mapping';

describe('keyAxis', () => {
  it('maps a key pair to -1, 0 or 1', () => {
    expect(keyAxis(false, true)).toBe(1);
    expect(keyAxis(true, false)).toBe(-1);
    expect(keyAxis(false, false)).toBe(0);
    expect(keyAxis(true, true)).toBe(0);
  });
});

describe('mouseButtons', () => {
  it('fires the main gun on right click and alt fire on left click', () => {
    expect(mouseButtons(false, true, true)).toEqual({ fire: true, altFire: false, armed: true });
    expect(mouseButtons(true, false, true)).toEqual({ fire: false, altFire: true, armed: true });
  });

  it('ignores buttons until they have been released once (title-screen click)', () => {
    const held = mouseButtons(true, false, false);
    expect(held).toEqual({ fire: false, altFire: false, armed: false });
    const released = mouseButtons(false, false, held.armed);
    expect(released.armed).toBe(true);
    expect(mouseButtons(true, false, released.armed).altFire).toBe(true);
  });
});

describe('padAnalog', () => {
  it('drives forward with the left stick pushed up and turns with X', () => {
    const c = padAnalog(1, -1, 0, 0);
    expect(c.throttle).toBeGreaterThan(0.5);
    expect(c.turn).toBeGreaterThan(0.5);
  });

  it('ignores stick drift inside the deadzone', () => {
    expect(padAnalog(0.1, -0.1, 0.2, 0.2)).toEqual({ throttle: 0, turn: 0, aimAngle: null });
  });

  it('aims with the right stick, keeping the current aim when centred', () => {
    expect(padAnalog(0, 0, 0, 1).aimAngle).toBeCloseTo(Math.PI / 2);
    expect(padAnalog(0, 0, 0, 0).aimAngle).toBeNull();
  });
});

describe('touchMove', () => {
  it('drives with the left stick (up = forward)', () => {
    const c = touchMove({ x: 0, y: -1, active: true });
    expect(c.throttle).toBeCloseTo(1);
    expect(c.turn).toBe(0);
  });

  it('ignores a thumb resting near the centre', () => {
    expect(touchMove({ x: 0.1, y: 0.05, active: true })).toEqual({ throttle: 0, turn: 0 });
  });

  it('stops when the stick is released', () => {
    expect(touchMove({ x: 0, y: 0, active: false })).toEqual({ throttle: 0, turn: 0 });
  });
});

describe('padLobDistance', () => {
  it('maps right-stick tilt past the aim deadzone onto min..max range', () => {
    expect(padLobDistance(0.1, 48, 220)).toBeNull();
    expect(padLobDistance(PAD_AIM_DEADZONE + 0.0001, 48, 220)).toBeCloseTo(48, 0);
    expect(padLobDistance(1, 48, 220)).toBe(220);
    expect(padLobDistance(1.4, 48, 220)).toBe(220);
    const mid = (1 + PAD_AIM_DEADZONE) / 2;
    expect(padLobDistance(mid, 48, 220)).toBeCloseTo(134);
  });
});

import { describe, expect, it } from 'vitest';
import { selectDevice } from './device';

const none = { keyboardMouse: false, gamepad: false, touch: false };

describe('selectDevice', () => {
  it('keeps the current device while nothing is used', () => {
    expect(selectDevice('gamepad', none)).toBe('gamepad');
  });

  it('switches to the device the player just used', () => {
    expect(selectDevice('keyboardMouse', { ...none, gamepad: true })).toBe('gamepad');
    expect(selectDevice('gamepad', { ...none, keyboardMouse: true })).toBe('keyboardMouse');
  });

  it('stays on the current device if it is among several used this frame', () => {
    expect(selectDevice('gamepad', { keyboardMouse: true, gamepad: true, touch: false })).toBe(
      'gamepad',
    );
  });
});

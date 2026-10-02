import { describe, expect, it } from 'vitest';
import {
  BIND_SLOTS,
  bindableActions,
  defaultKeybinds,
  isBindableKey,
  keyNameFromEvent,
  PAUSE_KEY,
  rebind,
  sanitizeKeybinds,
  unbind,
} from './keybinds';

describe('defaultKeybinds', () => {
  it('matches the GAME_DESIGN.md controls table', () => {
    const b = defaultKeybinds();
    expect(b.throttle_fwd).toEqual(['W', 'UP']);
    expect(b.throttle_back).toEqual(['S', 'DOWN']);
    expect(b.turn_left).toEqual(['A', 'LEFT']);
    expect(b.turn_right).toEqual(['D', 'RIGHT']);
    expect(b.cycle_prev).toEqual(['Q']);
    expect(b.cycle_next).toEqual(['E']);
    expect(b.hatch).toEqual(['F']);
    expect(b.interact).toEqual(['SPACE']);
    expect(b.repair).toEqual(['R']);
    expect(b.map).toEqual(['M', 'TAB']);
  });

  it('binds every action, no key twice, and never the pause key', () => {
    const b = defaultKeybinds();
    const keys = bindableActions.flatMap((a) => b[a]);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain(PAUSE_KEY);
    for (const a of bindableActions) expect(b[a].length).toBeGreaterThan(0);
  });

  it('returns a fresh copy each time', () => {
    defaultKeybinds().hatch.push('X');
    expect(defaultKeybinds().hatch).toEqual(['F']);
  });
});

describe('rebind', () => {
  it('replaces the key in the given slot', () => {
    const b = rebind(defaultKeybinds(), 'hatch', 0, 'H');
    expect(b.hatch).toEqual(['H']);
  });

  it('adds a second key in slot 1', () => {
    expect(rebind(defaultKeybinds(), 'hatch', 1, 'H').hatch).toEqual(['F', 'H']);
  });

  it('takes the key away from whatever action held it', () => {
    const b = rebind(defaultKeybinds(), 'hatch', 0, 'E');
    expect(b.hatch).toEqual(['E']);
    expect(b.cycle_next).toEqual([]);
  });

  it('is a no-op for the pause key and unknown keys', () => {
    const before = defaultKeybinds();
    expect(rebind(before, 'hatch', 0, PAUSE_KEY)).toEqual(before);
    expect(rebind(before, 'hatch', 0, 'NOT_A_KEY')).toEqual(before);
  });

  it('does not mutate its input', () => {
    const before = defaultKeybinds();
    rebind(before, 'hatch', 0, 'E');
    expect(before).toEqual(defaultKeybinds());
  });

  it('only has BIND_SLOTS slots', () => {
    expect(BIND_SLOTS).toBe(2);
    expect(rebind(defaultKeybinds(), 'hatch', 5, 'H').hatch).toEqual(['F', 'H']);
  });
});

describe('unbind', () => {
  it('clears one slot', () => {
    expect(unbind(defaultKeybinds(), 'map', 1).map).toEqual(['M']);
    expect(unbind(defaultKeybinds(), 'map', 0).map).toEqual(['TAB']);
  });
});

describe('sanitizeKeybinds', () => {
  it('falls back to the defaults for anything missing or broken', () => {
    expect(sanitizeKeybinds(null)).toEqual(defaultKeybinds());
    expect(sanitizeKeybinds({ hatch: 'F' })).toEqual(defaultKeybinds());
  });

  it('keeps valid bindings and drops unknown actions and keys', () => {
    const b = sanitizeKeybinds({ hatch: ['H', 'NOPE'], fly: ['X'] });
    expect(b.hatch).toEqual(['H']);
    expect(b).not.toHaveProperty('fly');
  });

  it('removes duplicates across actions (first action wins) and the pause key', () => {
    const b = sanitizeKeybinds({ throttle_fwd: ['W'], hatch: ['W', 'ESC', 'H'] });
    expect(b.throttle_fwd).toEqual(['W']);
    expect(b.hatch).toEqual(['H']);
  });

  it('caps each action at BIND_SLOTS keys', () => {
    expect(sanitizeKeybinds({ hatch: ['H', 'J', 'K'] }).hatch).toEqual(['H', 'J']);
  });
});

describe('keys', () => {
  it('knows letters, digits, arrows and common keys', () => {
    for (const k of ['A', 'Z', 'ZERO', 'NINE', 'UP', 'SPACE', 'TAB', 'SHIFT', 'ENTER'])
      expect(isBindableKey(k)).toBe(true);
    expect(isBindableKey(PAUSE_KEY)).toBe(false);
    expect(isBindableKey('a')).toBe(false);
  });

  it('names DOM key events the way Phaser KeyCodes do', () => {
    expect(keyNameFromEvent('KeyW')).toBe('W');
    expect(keyNameFromEvent('Digit3')).toBe('THREE');
    expect(keyNameFromEvent('ArrowLeft')).toBe('LEFT');
    expect(keyNameFromEvent('Space')).toBe('SPACE');
    expect(keyNameFromEvent('ShiftLeft')).toBe('SHIFT');
    expect(keyNameFromEvent('Escape')).toBe('ESC');
    expect(keyNameFromEvent('F13')).toBeNull();
  });
});

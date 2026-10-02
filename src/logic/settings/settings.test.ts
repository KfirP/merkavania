import { describe, expect, it } from 'vitest';
import { defaultKeybinds } from '../input/keybinds';
import type { StorageLike } from '../save/save';
import {
  defaultSettings,
  deserializeSettings,
  SETTINGS_KEY,
  SETTINGS_VERSION,
  SettingsStore,
} from './settings';

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('defaultSettings', () => {
  it('is English, automatic touch controls, full volume and the default keys', () => {
    expect(defaultSettings()).toEqual({
      version: SETTINGS_VERSION,
      language: 'en',
      touchControls: 'auto',
      volume: { master: 1, sfx: 1, music: 1 },
      keybinds: defaultKeybinds(),
    });
  });
});

describe('deserializeSettings', () => {
  it('round-trips through JSON', () => {
    const s = defaultSettings();
    s.language = 'he';
    s.touchControls = 'off';
    s.volume.music = 0.4;
    s.keybinds.hatch = ['H'];
    expect(deserializeSettings(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('falls back to the defaults for garbage', () => {
    for (const raw of [null, 3, 'x', [], { language: 'fr', touchControls: 'maybe' }])
      expect(deserializeSettings(raw)).toEqual(defaultSettings());
  });

  it('keeps the valid parts of a partial object', () => {
    const s = deserializeSettings({ language: 'he', volume: { sfx: 0.5 } });
    expect(s.language).toBe('he');
    expect(s.volume).toEqual({ master: 1, sfx: 0.5, music: 1 });
    expect(s.keybinds).toEqual(defaultKeybinds());
  });

  it('clamps volumes to 0..1 and ignores non-numbers', () => {
    const s = deserializeSettings({ volume: { master: 3, sfx: -1, music: 'loud' } });
    expect(s.volume).toEqual({ master: 1, sfx: 0, music: 1 });
  });
});

describe('SettingsStore', () => {
  it('saves under merkavania.settings and loads it back', () => {
    const storage = fakeStorage();
    const store = new SettingsStore(storage);
    const s = defaultSettings();
    s.language = 'he';
    expect(store.save(s)).toBe(true);
    expect(storage.data.has(SETTINGS_KEY)).toBe(true);
    expect(SETTINGS_KEY).toBe('merkavania.settings');
    expect(store.load()).toEqual(s);
  });

  it('loads the defaults when nothing is stored or it is unreadable', () => {
    const storage = fakeStorage();
    expect(new SettingsStore(storage).load()).toEqual(defaultSettings());
    storage.data.set(SETTINGS_KEY, '{nope');
    expect(new SettingsStore(storage).load()).toEqual(defaultSettings());
  });

  it('swallows storage errors', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {},
    };
    const store = new SettingsStore(broken);
    expect(store.load()).toEqual(defaultSettings());
    expect(store.save(defaultSettings())).toBe(false);
  });
});

import { defaultKeybinds, sanitizeKeybinds, type Keybinds } from '../input/keybinds';
import type { StorageLike } from '../save/save';

/**
 * Player settings (docs/ARCHITECTURE.md, Save system): one JSON blob under `merkavania.settings`,
 * separate from the save slots. Unlike saves, nothing here is worth migrating: anything unreadable
 * falls back to its default.
 */
export const SETTINGS_KEY = 'merkavania.settings';
export const SETTINGS_VERSION = 1;

export const languages = ['en', 'he'] as const;
export type Language = (typeof languages)[number];

/** `auto` shows the touch controls on touch devices; `on`/`off` force them. */
export const touchModes = ['auto', 'on', 'off'] as const;
export type TouchMode = (typeof touchModes)[number];

export const volumeChannels = ['master', 'sfx', 'music'] as const;
export type VolumeChannel = (typeof volumeChannels)[number];

export interface Settings {
  version: number;
  language: Language;
  touchControls: TouchMode;
  /** 0..1 each; the audio arrives in M8. */
  volume: Record<VolumeChannel, number>;
  keybinds: Keybinds;
}

export function defaultSettings(): Settings {
  return {
    version: SETTINGS_VERSION,
    language: 'en',
    touchControls: 'auto',
    volume: { master: 1, sfx: 1, music: 1 },
    keybinds: defaultKeybinds(),
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback;

/** Stored settings → valid settings, keeping whatever parts are usable. Never throws. */
export function deserializeSettings(raw: unknown): Settings {
  const s = defaultSettings();
  if (!isRecord(raw)) return s;
  s.language = oneOf(languages, raw.language, s.language);
  s.touchControls = oneOf(touchModes, raw.touchControls, s.touchControls);
  if (isRecord(raw.volume))
    for (const ch of volumeChannels) {
      const v = raw.volume[ch];
      if (typeof v === 'number' && Number.isFinite(v)) s.volume[ch] = Math.min(1, Math.max(0, v));
    }
  if (raw.keybinds !== undefined) s.keybinds = sanitizeKeybinds(raw.keybinds);
  return s;
}

/** Reads and writes the settings; storage errors never reach the game. */
export class SettingsStore {
  constructor(private readonly storage: StorageLike) {}

  load(): Settings {
    try {
      const text = this.storage.getItem(SETTINGS_KEY);
      return deserializeSettings(text === null ? null : JSON.parse(text));
    } catch {
      return defaultSettings();
    }
  }

  /** False if the storage refused the write. */
  save(s: Settings): boolean {
    try {
      this.storage.setItem(SETTINGS_KEY, JSON.stringify(s));
      return true;
    } catch {
      return false;
    }
  }
}

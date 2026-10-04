import { setLanguage } from '../i18n/i18n';
import { SettingsStore, type Settings } from '../logic/settings/settings';
import { browserStorage } from './storage';

const store = new SettingsStore(browserStorage());
let current: Settings = store.load();

/** The player's settings, loaded once at startup. Read-only: change them through `updateSettings`. */
export function settings(): Readonly<Settings> {
  return current;
}

/** Changes the settings, saves them and applies the language. */
export function updateSettings(change: (s: Settings) => void): void {
  const next = structuredClone(current);
  change(next);
  current = next;
  store.save(current);
  setLanguage(current.language);
}

/** Applies the stored settings that take effect globally (the language); call before any scene. */
export function applySettings(): void {
  setLanguage(current.language);
}

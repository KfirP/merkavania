import en from './en.json';
import he from './he.json';
import type { Language } from '../logic/settings/settings';

export type { Language };
export type I18nKey = keyof typeof en;

export const dictionaries: Record<Language, Record<string, string>> = { en, he };

let current: Language = 'en';
const listeners = new Set<(language: Language) => void>();

export function setLanguage(language: Language): void {
  if (language === current) return;
  current = language;
  for (const fn of [...listeners]) fn(language);
}

/** Calls `fn` whenever the language changes (so scenes can redraw their text); returns the unsubscribe. */
export function onLanguageChange(fn: (language: Language) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getLanguage(): Language {
  return current;
}

export function isRtl(language: Language = current): boolean {
  return language === 'he';
}

/** Looks up `key` in the current language, falling back to English, and fills `{name}` params. */
export function t(key: I18nKey, params?: Record<string, string | number>): string {
  const template = dictionaries[current][key] ?? en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

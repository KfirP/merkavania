import en from './en.json';
import he from './he.json';

export type Language = 'en' | 'he';
export type I18nKey = keyof typeof en;

export const dictionaries: Record<Language, Record<string, string>> = { en, he };

let current: Language = 'en';

export function setLanguage(language: Language): void {
  current = language;
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

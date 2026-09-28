import { afterEach, describe, expect, it } from 'vitest';
import en from './en.json';
import he from './he.json';
import { setLanguage, t } from './i18n';

describe('i18n', () => {
  afterEach(() => setLanguage('en'));

  it('he.json has exactly the same keys as en.json', () => {
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
  });

  it('has no empty strings', () => {
    for (const dict of [en, he]) {
      for (const value of Object.values(dict)) expect(value.trim()).not.toBe('');
    }
  });

  it('translates in the current language', () => {
    expect(t('title.name')).toBe(en['title.name']);
    setLanguage('he');
    expect(t('title.name')).toBe(he['title.name']);
  });
});

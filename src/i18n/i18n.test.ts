import { afterEach, describe, expect, it } from 'vitest';
import en from './en.json';
import he from './he.json';
import { abilityIds, minorPickupIds } from '../data/abilities';
import { secondaryIds } from '../data/progression';
import { onLanguageChange, setLanguage, t } from './i18n';

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

  it('tells listeners when the language changes, until they unsubscribe', () => {
    const seen: string[] = [];
    const off = onLanguageChange((l) => seen.push(l));
    setLanguage('he');
    setLanguage('he');
    setLanguage('en');
    off();
    setLanguage('he');
    expect(seen).toEqual(['he', 'en']);
  });
});

describe('progression text', () => {
  it('names every ability and minor pickup', () => {
    for (const id of [...abilityIds, ...minorPickupIds])
      expect(en).toHaveProperty([`pickup.${id}`]);
  });

  it('labels every secondary in the HUD', () => {
    for (const id of secondaryIds) expect(en).toHaveProperty([`hud.secondary.${id}`]);
  });
});

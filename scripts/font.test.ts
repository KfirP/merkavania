import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAsset } from '../src/data/assetManifest';
import en from '../src/i18n/en.json';
import he from '../src/i18n/he.json';
import { readCodepoints } from './fontCmap';

describe('UI font', () => {
  it('has a glyph for every character the i18n files use', () => {
    const font = readFileSync(new URL(`../public/${getAsset('font_ui').path}`, import.meta.url));
    const glyphs = readCodepoints(font);
    const used = new Set([...Object.values(en), ...Object.values(he)].join(''));
    const missing = [...used].filter((c) => c !== ' ' && !glyphs.has(c.codePointAt(0)!));
    expect(missing).toEqual([]);
  });
});

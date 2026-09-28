import { describe, expect, it } from 'vitest';
import { assetManifest } from '../data/assetManifest';
import { hasPlaceholder } from './placeholders';

describe('placeholders', () => {
  it('can draw every manifest entry that has no file', () => {
    const missing = assetManifest.filter((a) => a.path === '' && !hasPlaceholder(a.key));
    expect(missing.map((a) => a.key)).toEqual([]);
  });
});

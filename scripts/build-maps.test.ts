import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildBiome, builtBiomes, committed, PUBLIC_MAPS } from './mapSources';

describe('build:maps', () => {
  it('has built every biome in maps-src (run `npm run build:maps` after editing a layout)', async () => {
    for (const biome of builtBiomes()) {
      const files = await buildBiome(biome);
      for (const [path, text] of files) expect(committed(path) === text, path).toBe(true);
      const onDisk = readdirSync(new URL(`${biome}/`, PUBLIC_MAPS)).filter((f) =>
        f.endsWith('.tmj'),
      );
      expect(onDisk.sort()).toEqual(
        [...files.keys()]
          .filter((p) => p.endsWith('.tmj'))
          .map((p) => p.split('/')[1])
          .sort(),
      );
    }
  });
});

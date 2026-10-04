/**
 * Builds the Tiled chunk maps and `.world` of every biome under maps-src/ into public/maps/
 * (docs/LEVEL_DESIGN.md, Built maps). Run after editing a layout, then `npm run validate:maps`:
 *   npm run build:maps
 * Stale chunk files (no longer in maps-src) are removed.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { buildBiome, builtBiomes, committed, PUBLIC_MAPS } from './mapSources';

for (const biome of builtBiomes()) {
  const files = await buildBiome(biome);
  const dir = new URL(`${biome}/`, PUBLIC_MAPS);
  mkdirSync(dir, { recursive: true });
  let changed = 0;
  for (const [path, text] of files) {
    if (committed(path) === text) continue;
    writeFileSync(new URL(path, PUBLIC_MAPS), text);
    changed++;
  }
  for (const file of readdirSync(dir))
    if (/\.tmj$/.test(file) && !files.has(`${biome}/${file}`)) {
      rmSync(new URL(file, dir));
      changed++;
    }
  console.log(`build:maps: ${biome}: ${files.size} file(s), ${changed} changed`);
}

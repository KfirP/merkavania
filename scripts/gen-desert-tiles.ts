/**
 * Writes the desert tileset (scripts/desertTiles.ts): public/assets/tiles/desert/desert.png and
 * public/maps/desert/desert.tsj, plus the palette as assets-src/palettes/desert.hex. Re-run after
 * changing a tile, then `npm run build:maps`:
 *   npx tsx scripts/gen-desert-tiles.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { desertPaletteHex, desertTiles } from './desertTiles';
import { writeTileset } from './tileset';

writeTileset(
  'tiles_desert',
  'assets/tiles/desert/desert.png',
  'maps/desert/desert.tsj',
  desertTiles,
);

const palettes = new URL('../assets-src/palettes/', import.meta.url);
mkdirSync(palettes, { recursive: true });
writeFileSync(
  new URL('desert.hex', palettes),
  desertPaletteHex.map((h) => h.toString(16).padStart(6, '0')).join('\n') + '\n',
);

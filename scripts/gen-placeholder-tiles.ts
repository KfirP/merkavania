/**
 * Draws the flat-colour placeholder tilesets Tiled needs until real art exists, and writes their
 * `.tsj` files with the tile properties. Re-run after changing a tile:
 *   npx tsx scripts/gen-placeholder-tiles.ts
 * Outputs: the shared elevation tileset (maps/shared/elevation.tsj) and the test terrain tileset
 * (maps/test/terrain.tsj), with their PNGs under public/assets/tiles/.
 */
import { T, writeTileset, type Pixels, type RGBA, type TileDef } from './tileset';

// --- Tile painters ---

const hex = (h: number, a = 255): RGBA => [(h >> 16) & 255, (h >> 8) & 255, h & 255, a];
/** Deterministic per-pixel noise, so regenerating gives identical files. */
const noise = (x: number, y: number, seed: number) =>
  (((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)) >>> 0) % 100;

const flat =
  (base: number, speck?: number, density = 12, seed = 1): Pixels =>
  (x, y) =>
    speck !== undefined && noise(x, y, seed) < density ? hex(speck) : hex(base);

const stripes =
  (base: number, line: number, horizontal: boolean, gap = 4): Pixels =>
  (x, y) =>
    (horizontal ? y : x) % gap === 0 ? hex(line) : hex(base);

const border =
  (inner: Pixels, edge: number): Pixels =>
  (x, y) =>
    x === 0 || y === 0 || x === T - 1 || y === T - 1 ? hex(edge) : inner(x, y);

/** An arrow pointing `dir` (the ramp's up direction), doubled for steep ramps. */
function arrow(dir: 'n' | 'e' | 's' | 'w', steep: boolean, fill: RGBA, ink: RGBA): Pixels {
  return (x, y) => {
    // Draw an east-pointing arrow in (u, v), then rotate into place.
    const [u, v] =
      dir === 'e' ? [x, y] : dir === 'w' ? [T - 1 - x, y] : dir === 'n' ? [T - 1 - y, x] : [y, x];
    const shaft = v >= 7 && v <= 8 && u >= 3 && u <= 12;
    const head = (tip: number) => u <= tip && u >= tip - 4 && Math.abs(v - 7.5) <= tip - u + 0.5;
    return shaft || head(12) || (steep && head(8)) ? ink : fill;
  };
}

const LEVEL_COLOURS = [0x3ec7d6, 0xe8d24a, 0xe8883a, 0xd6453e];
const DIRS = ['n', 'e', 's', 'w'] as const;

function elevationTiles(): TileDef[] {
  const tiles: TileDef[] = [];
  const digit =
    (level: number): Pixels =>
    (x, y) =>
      // Level shown as 1..4 dots along the top so Tiled users can tell them apart.
      y === 3 && x >= 3 && x < 3 + level * 3 && (x - 3) % 3 !== 2
        ? hex(0x000000, 200)
        : hex(LEVEL_COLOURS[level]!, 110);
  for (let level = 0; level <= 3; level++)
    tiles.push({
      draw: border(digit(level), 0x000000),
      properties: [{ name: 'level', type: 'int', value: level }],
    });
  for (const steep of [false, true])
    for (let level = 0; level <= 2; level++)
      for (const dir of DIRS)
        tiles.push({
          draw: arrow(
            dir,
            steep,
            hex(LEVEL_COLOURS[level]!, 110),
            steep ? hex(0xb00020, 230) : hex(0x000000, 200),
          ),
          properties: [
            { name: 'level', type: 'int', value: level },
            { name: 'ramp', type: 'string', value: dir },
            ...(steep ? [{ name: 'steep', type: 'bool' as const, value: true }] : []),
          ],
        });
  return tiles;
}

const terrain = (value: string) => [{ name: 'terrain', type: 'string' as const, value }];

/** Order is the tile id; append new tiles at the end so existing maps keep their gids. */
function testTerrainTiles(): TileDef[] {
  return [
    { draw: flat(0x8a8178, 0x6e665e, 25, 2), properties: terrain('rock') },
    { draw: flat(0x7fc4d8, 0xa8dcea, 10, 3), properties: terrain('water_shallow') },
    { draw: flat(0x1f4f8a, 0x2c64a8, 10, 4), properties: terrain('water_deep') },
    { draw: flat(0x6b4a2b, 0x553820, 30, 5), properties: terrain('mud') },
    { draw: flat(0x9a948c, 0x5a544c, 35, 6), properties: terrain('rubble') },
    {
      draw: (x, y) =>
        noise(x >> 2, y >> 2, 7) < 20 && (x & 3) === 1 && (y & 3) === 1
          ? hex(0xc01818)
          : hex(0xd4b483),
      properties: terrain('minefield'),
    },
    { draw: flat(0x2e2a26, 0x3c3730, 15, 8), properties: terrain('crawlspace') },
    { draw: flat(0x0a0a0a, 0x1a1a1a, 5, 9), properties: terrain('chasm') },
    { draw: stripes(0xd4b483, 0xc0302a, false, 5), properties: terrain('missile_zone') },
    // Plateau ground: sand, lighter per level, so height reads at a glance.
    { draw: flat(0xe3c896, 0xd4b483, 10, 10), properties: terrain('sand') },
    { draw: flat(0xf0dcae, 0xe3c896, 10, 11), properties: terrain('sand') },
    // Plateau rim: the edge cells of a plateau, darker so the cliff line is visible.
    { draw: border(flat(0xe3c896), 0x7a6040), properties: terrain('sand') },
    // Ramp surfaces: normal (brown ridges), steep (red ridges telegraph the suspension gate).
    { draw: stripes(0xcfae7a, 0x9c7c4c, true), properties: terrain('sand') },
    { draw: stripes(0xcfae7a, 0xb00020, true, 3), properties: terrain('sand') },
  ];
}

writeTileset(
  'tiles_elevation',
  'assets/tiles/elevation.png',
  'maps/shared/elevation.tsj',
  elevationTiles(),
);
writeTileset(
  'tiles_test_terrain',
  'assets/tiles/test/terrain.png',
  'maps/test/terrain.tsj',
  testTerrainTiles(),
);

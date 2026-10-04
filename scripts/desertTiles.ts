import type { TilePalette } from './mapBuild';
import { T, type Pixels, type RGBA, type TileDef } from './tileset';

/**
 * The desert tileset (`tiles_desert`): pixel art drawn in code from the desert palette
 * (assets-src/palettes/desert.hex), plus the map-builder palette that names its tiles. Both come
 * from one ordered list, so a tile's id is its position: append new tiles at the end.
 *
 * Ground legend (`ground` grids): `.` sand, `,` packed sand, `=` road, `r` rock, `%` rubble,
 * `c` crawlspace; walls (solid): `#` rock, `B` concrete, `S` sandbags.
 * Decor legend: `t` tyres, `x` crate, `o` barrel, `b` scorch mark, `k` sign, `W` 2×2 wreck.
 * Above legend: `N` camo net.
 */

const C = {
  sand: 0xdcc08a,
  sandMid: 0xcfb07a,
  sandDark: 0xbf9d66,
  sandLight: 0xead6a4,
  packed: 0xc9a872,
  packedDark: 0xb08e5c,
  road: 0xa58c6a,
  roadDark: 0x8a7457,
  roadLight: 0xbca684,
  rock: 0x9d876a,
  rockDark: 0x7c6850,
  rockLight: 0xb9a383,
  rubble: 0x969088,
  rubbleDark: 0x6a645c,
  rubbleLight: 0xb4aea4,
  rebar: 0x7a4a2a,
  crawl: 0x2c241e,
  crawlMid: 0x463a2e,
  plank: 0x7a6040,
  wallRock: 0x7a6448,
  wallRockDark: 0x54442f,
  wallRockLight: 0x9c8462,
  concrete: 0xa9a79f,
  concreteDark: 0x7d7b73,
  concreteLight: 0xc6c4bc,
  bag: 0xcbb282,
  bagDark: 0x8e7a50,
  bagLight: 0xe0cc9c,
  rimLight: 0xf6e6bc,
  cliff1: 0xae8f5f,
  cliff2: 0x8a6c44,
  cliff3: 0x5e4a30,
  ramp: 0x9c7c4c,
  hazard: 0xc0302a,
  hazardLight: 0xf0c040,
  scrub: 0x7d8a4a,
  scrubDark: 0x5a6634,
  olive: 0x6b6b3a,
  oliveDark: 0x4a4a28,
  rust: 0x8a4a2a,
  rustDark: 0x5a3020,
  burnt: 0x3a3430,
  tyre: 0x2a2826,
  tyreMid: 0x46423e,
  wood: 0xa07a48,
  woodDark: 0x6e5030,
  barrel: 0x4f6a3a,
  barrelDark: 0x34482a,
  net: 0x5e6a38,
} as const;

/** Every hex value used, for assets-src/palettes/desert.hex. */
export const desertPaletteHex = [...new Set(Object.values(C))];

const rgba = (h: number, a = 255): RGBA => [(h >> 16) & 255, (h >> 8) & 255, h & 255, a];
/** Deterministic noise 0..99. */
const noise = (x: number, y: number, seed: number) =>
  (((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)) >>> 0) % 100;

/** Lightens a colour toward pale sand: higher ground reads lighter. */
function lift(h: number, level: number): number {
  const k = level * 0.1;
  const mix = (c: number, t: number) => Math.round(c + (t - c) * k);
  const [r, g, b] = rgba(h);
  return (mix(r, 0xff) << 16) | (mix(g, 0xf4) << 8) | mix(b, 0xd8);
}

type Painter = (x: number, y: number) => number | null;
const solid =
  (p: Painter, alpha = 255): Pixels =>
  (x, y) => {
    const c = p(x, y);
    return c === null ? null : rgba(c, alpha);
  };
const lifted = (p: Painter, level: number): Pixels =>
  solid((x, y) => {
    const c = p(x, y);
    return c === null ? null : lift(c, level);
  });

// --- Ground painters (opaque) ---

const sandA =
  (seed: number): Painter =>
  (x, y) => {
    const n = noise(x, y, seed);
    return n < 6 ? C.sandDark : n < 12 ? C.sandLight : n < 22 ? C.sandMid : C.sand;
  };
/** Faint wind ripples: broken wavy lines a shade darker. */
const sandRipple: Painter = (x, y) =>
  (y + Math.round(1.5 * Math.sin((x + y * 3) / 3))) % 6 === 0 && noise(x, y, 2) < 75
    ? C.sandMid
    : sandA(3)(x, y);
const sandPebbles: Painter = (x, y) => {
  const n = noise(x >> 1, y >> 1, 5);
  if (n < 4) return (x + y) % 2 ? C.rockDark : C.rock;
  return sandA(4)(x, y);
};
const packed: Painter = (x, y) => {
  const crack =
    (x === 5 && y > 3 && y < 10) || (y === 10 && x >= 5 && x < 12) || (x === 11 && y > 10);
  if (crack) return C.packedDark;
  const n = noise(x, y, 6);
  return n < 10 ? C.packedDark : n < 18 ? C.sandMid : C.packed;
};
const road: Painter = (x, y) => {
  const n = noise(x, y, 7);
  return n < 14 ? C.roadDark : n < 26 ? C.roadLight : C.road;
};
const rock: Painter = (x, y) => {
  const blotch = noise(x >> 2, y >> 2, 8);
  const n = noise(x, y, 9);
  if (n < 8) return C.rockLight;
  return blotch < 30 ? C.rockDark : n < 30 ? C.rockLight : C.rock;
};
/** Broken concrete chunks and rebar over sand: obviously impassable without a blade. */
const rubble: Painter = (x, y) => {
  const chunk = noise(x >> 2, y >> 2, 10);
  const inChunk = chunk < 70 && (x % 4 !== 3 || noise(x, y, 11) < 30) && y % 4 !== 3;
  if ((x + 2 * y) % 13 === 0 && y % 5 !== 0) return C.rebar;
  if (inChunk) {
    if (x % 4 === 0 || y % 4 === 0) return C.rubbleLight;
    return chunk < 25 ? C.rubbleDark : C.rubble;
  }
  return y % 4 === 3 ? C.rubbleDark : C.sandDark;
};
/** Rubble the dozer has flattened: sand with a few grey bits and blade marks. */
const rubbleCleared: Painter = (x, y) => {
  if (y % 5 === 2 && noise(x, y, 12) < 70) return C.sandDark;
  const n = noise(x, y, 13);
  if (n < 7) return C.rubble;
  if (n < 10) return C.rubbleDark;
  return sandA(14)(x, y);
};
/** A culvert just big enough for a soldier: dark opening with plank supports. */
const crawl: Painter = (x, y) => {
  if (y === 0 || y === T - 1) return C.plank;
  if (x % 8 === 0) return C.plank;
  return noise(x, y, 15) < 20 ? C.crawlMid : C.crawl;
};

// --- Walls (opaque, solid) ---

const wallRock: Painter = (x, y) => {
  if (y === 0 || (y === 1 && noise(x, 0, 16) < 50)) return C.wallRockLight;
  if (y >= 13) return y === 15 ? C.cliff3 : C.wallRockDark;
  const crack = noise(x >> 1, y >> 1, 17) < 12;
  if (crack) return C.wallRockDark;
  return noise(x, y, 18) < 18 ? C.wallRockLight : C.wallRock;
};
const concrete: Painter = (x, y) => {
  if (y === 0) return C.concreteLight;
  if (y >= 14) return C.concreteDark;
  if (y === 7 || (x === 8 && y < 7) || (x === 0 && y > 7)) return C.concreteDark;
  return noise(x, y, 19) < 8 ? C.concreteDark : C.concrete;
};
const sandbags: Painter = (x, y) => {
  const row = Math.floor(y / 4);
  const off = row % 2 ? 4 : 0;
  const bx = (x + off) % 8;
  const by = y % 4;
  if (by === 3 || bx === 7) return C.bagDark;
  if (by === 0 && bx > 0 && bx < 6) return C.bagLight;
  return C.bag;
};

// --- Overlays (transparent) ---

/** Rim edges of higher ground: lit top edge, a cliff face along the bottom, shaded sides. */
function rimTile(mask: number): Pixels {
  return (x, y) => {
    if (mask & 4 && y >= 13) return rgba(y === 13 ? C.cliff1 : y === 14 ? C.cliff2 : C.cliff3);
    if (mask & 1 && y === 0) return rgba(C.rimLight);
    if (mask & 2 && x >= 14) return rgba(x === 14 ? C.cliff1 : C.cliff2);
    if (mask & 8 && x <= 1) return rgba(x === 1 ? C.cliff1 : C.cliff2);
    return null;
  };
}

/** Chevrons pointing up the ramp: brown for normal ramps, red-and-yellow hazard for steep. */
function rampTile(dir: 'n' | 'e' | 's' | 'w', steep: boolean): Pixels {
  return (x, y) => {
    // Draw an east-pointing pattern in (u, v), then rotate into place.
    const [u, v] =
      dir === 'e' ? [x, y] : dir === 'w' ? [T - 1 - x, y] : dir === 'n' ? [T - 1 - y, x] : [y, x];
    const side = v === 0 || v === T - 1;
    if (side) return rgba(steep ? C.hazard : C.cliff2, 220);
    const d = Math.abs(v - 7.5);
    const period = steep ? 5 : 8;
    const phase = (u + Math.floor(d)) % period;
    if (phase === 0) return rgba(steep ? C.hazard : C.ramp, 230);
    if (steep && phase === 1) return rgba(C.hazardLight, 200);
    return null;
  };
}

// --- Decor (transparent) ---

const pebbles: Pixels = (x, y) =>
  (x === 4 && y === 9) || (x === 5 && y === 9) || (x === 10 && y === 5)
    ? rgba(C.rockDark)
    : (x === 4 && y === 8) || (x === 10 && y === 4)
      ? rgba(C.rockLight)
      : x === 12 && y === 11
        ? rgba(C.rock)
        : null;
const scrub: Pixels = (x, y) => {
  const d = Math.hypot(x - 8, y - 8);
  if (d > 5) return null;
  const n = noise(x, y, 20);
  if (n < 35) return null;
  return rgba(d < 2.5 ? C.scrubDark : n < 60 ? C.scrub : C.scrubDark);
};
const tuft: Pixels = (x, y) =>
  y >= 7 && y <= 11 && (x === 6 || x === 8 || x === 10) && (y > 8 || x === 8)
    ? rgba(y < 9 ? C.scrub : C.scrubDark)
    : null;
const stones: Pixels = (x, y) => {
  const r = Math.hypot(x - 7, y - 8);
  if (r < 2.5) return rgba(r < 1.2 ? C.rockLight : C.rock);
  if (Math.hypot(x - 11, y - 10) < 1.5) return rgba(C.rockDark);
  return null;
};

const ring =
  (cx: number, cy: number): ((x: number, y: number) => number | null) =>
  (x, y) => {
    const d = Math.hypot(x - cx, y - cy);
    return d < 1.5 ? null : d < 2.6 ? C.tyreMid : d < 3.8 ? C.tyre : null;
  };
const tyres: Pixels = (x, y) => {
  const c = ring(5, 5)(x, y) ?? ring(11, 6)(x, y) ?? ring(8, 11)(x, y);
  return c === null ? null : rgba(c);
};
const crate: Pixels = (x, y) => {
  if (x < 3 || x > 12 || y < 3 || y > 12) return null;
  if (x === 3 || x === 12 || y === 3 || y === 12) return rgba(C.woodDark);
  if (x === y || x === 15 - y) return rgba(C.woodDark);
  return rgba(C.wood);
};
const barrel: Pixels = (x, y) => {
  const d = Math.hypot(x - 8, y - 8);
  if (d > 4.5) return null;
  if (d > 3.6) return rgba(C.barrelDark);
  if (Math.abs(d - 2) < 0.5) return rgba(C.barrelDark);
  return rgba(x < 8 && y < 8 ? C.olive : C.barrel);
};
const scorch: Pixels = (x, y) => {
  const d = Math.hypot(x - 8, y - 8) + (noise(x, y, 21) % 4) - 1.5;
  return d < 4 ? rgba(C.burnt, 220) : d < 6.5 ? rgba(C.burnt, 110) : null;
};
/** A crooked sign post (it says something rude in the radio messages). */
const sign: Pixels = (x, y) => {
  if (x === 8 && y >= 8 && y <= 14) return rgba(C.woodDark);
  if (y >= 3 && y <= 7 && x >= 3 && x <= 13) return rgba(y === 3 || y === 7 ? C.woodDark : C.wood);
  return null;
};
/** A burnt-out jeep, 32×32 over four tiles (east-facing). */
const wreck =
  (ox: number, oy: number): Pixels =>
  (x, y) => {
    const X = x + ox;
    const Y = y + oy;
    const inBody = X >= 3 && X <= 28 && Y >= 9 && Y <= 22;
    if (!inBody) {
      const wheel = [5, 24].some(
        (wx) => Math.abs(X - wx - 2) <= 2 && (Y === 7 || Y === 8 || Y === 23 || Y === 24),
      );
      return wheel ? rgba(C.tyre) : null;
    }
    if (X === 3 || X === 28 || Y === 9 || Y === 22) return rgba(C.rustDark);
    if (X >= 20 && X <= 26 && Y >= 11 && Y <= 20)
      return rgba(noise(X, Y, 22) < 40 ? C.burnt : C.rustDark);
    if (X >= 8 && X <= 16 && Y >= 12 && Y <= 19) return rgba(C.burnt);
    return rgba(noise(X, Y, 23) < 25 ? C.rustDark : C.rust);
  };
const camoNet: Pixels = (x, y) =>
  (x + y) % 3 === 0 || (x - y + 32) % 4 === 0
    ? rgba(noise(x, y, 24) < 50 ? C.net : C.olive, 190)
    : noise(x >> 1, y >> 1, 25) < 25
      ? rgba(C.scrubDark, 160)
      : null;

// --- Catalogue ---

const terrainProp = (value: string) => ({ name: 'terrain', type: 'string' as const, value });

/** Builds the tile list and the palette that refers to it, in one pass. */
function build(): { tiles: TileDef[]; palette: TilePalette } {
  const tiles: TileDef[] = [];
  const add = (t: TileDef) => tiles.push(t) - 1;

  const LEVELS = [0, 1, 2, 3];
  const perLevel = (p: Painter, terrain: string, extra: TileDef['properties'] = []) =>
    LEVELS.map((level) =>
      add({ draw: lifted(p, level), properties: [terrainProp(terrain), ...extra] }),
    );

  const sand = [
    perLevel(sandA(1), 'sand'),
    perLevel(sandRipple, 'sand'),
    perLevel(sandPebbles, 'sand'),
  ];
  const packedIds = perLevel(packed, 'sand');
  const roadIds = perLevel(road, 'road');
  const rockIds = perLevel(rock, 'rock');
  const clearedIds = perLevel(rubbleCleared, 'rubble');
  // A rubble tile names the tile it turns into once the tank has the dozer blade.
  const rubbleIds = LEVELS.map((level) =>
    add({
      draw: lifted(rubble, level),
      properties: [
        terrainProp('rubble'),
        { name: 'cleared', type: 'int', value: clearedIds[level]! },
      ],
    }),
  );
  const crawlIds = LEVELS.map(() =>
    add({ draw: solid(crawl), properties: [terrainProp('crawlspace')] }),
  );

  const solidProp = [{ name: 'solid', type: 'bool' as const, value: true }];
  const wallRockId = add({ draw: solid(wallRock), properties: solidProp });
  const concreteId = add({ draw: solid(concrete), properties: solidProp });
  const sandbagId = add({ draw: solid(sandbags), properties: solidProp });

  const rimIds = [0, ...Array.from({ length: 15 }, (_, i) => add({ draw: rimTile(i + 1) }))];
  const rampIds: Record<string, number> = {};
  for (const steep of [false, true])
    for (const dir of ['n', 'e', 's', 'w'] as const)
      rampIds[`${dir}${steep ? '!' : ''}`] = add({ draw: rampTile(dir, steep) });

  const scatterIds = [pebbles, scrub, tuft, stones].map((draw) => add({ draw }));
  const decor = {
    t: [[add({ draw: tyres })]],
    x: [[add({ draw: crate })]],
    o: [[add({ draw: barrel })]],
    b: [[add({ draw: scorch })]],
    k: [[add({ draw: sign })]],
    W: [
      [add({ draw: wreck(0, 0) }), add({ draw: wreck(16, 0) })],
      [add({ draw: wreck(0, 16) }), add({ draw: wreck(16, 16) })],
    ],
  };
  const above = { N: [[add({ draw: camoNet })]] };

  const byLevel = (ids: number[]) => ids.map((id) => [id]);
  const palette: TilePalette = {
    source: 'desert.tsj',
    tilecount: tiles.length,
    ground: {
      '.': { tiles: LEVELS.map((l) => [sand[0]![l]!, sand[0]![l]!, sand[1]![l]!, sand[2]![l]!]) },
      ',': { tiles: byLevel(packedIds) },
      '=': { tiles: byLevel(roadIds) },
      r: { tiles: byLevel(rockIds) },
      '%': { tiles: byLevel(rubbleIds) },
      c: { tiles: byLevel(crawlIds) },
      '#': { tiles: byLevel(rockIds), wall: wallRockId },
      B: { tiles: byLevel(packedIds), wall: concreteId },
      S: { tiles: byLevel(sand[0]!), wall: sandbagId },
    },
    ramp: (dir, steep) => rampIds[`${dir}${steep ? '!' : ''}`]!,
    rim: (mask) => rimIds[mask]!,
    decor,
    above,
    scatter: { on: '.', chance: 0.06, tiles: scatterIds },
  };
  return { tiles, palette };
}

const built = build();
export const desertTiles: TileDef[] = built.tiles;
export const desertPalette: TilePalette = built.palette;

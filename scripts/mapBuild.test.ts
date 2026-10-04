import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseChunkGrid, type GridMap } from '../src/logic/world/grid';
import { embedTilesets, resolveRelativePath, type TiledMap } from '../src/logic/world/tiled';
import { buildWorld, parseElevation, RIM, type TilePalette } from './mapBuild';
import { chunk, depot, enemy, path, pickup, spawn, type ChunkLayout } from './mapLayout';

/** A tiny palette: sand (2 variants per level), road, a rock wall; ids are local to its tileset. */
const palette: TilePalette = {
  source: 'tiny.tsj',
  tilecount: 40,
  ground: {
    '.': { tiles: [[0, 1], [2], [3], [4]] },
    '=': { tiles: [[5], [6], [7], [8]] },
    '#': { tiles: [[9], [9], [9], [9]], wall: 10 },
  },
  ramp: (dir, steep) => 11 + ['n', 'e', 's', 'w'].indexOf(dir) + (steep ? 4 : 0),
  rim: (mask) => 19 + mask,
  decor: {
    t: [[35]],
    W: [
      [36, 37],
      [38, 39],
    ],
  },
  above: { N: [[34]] },
  scatter: { on: '.', chance: 0.5, tiles: [35] },
};

/** The tileset the test palette stands for, so built maps can be parsed back. */
const tinyTileset = {
  name: 'tiny',
  tiles: [
    ...[0, 1, 2, 3, 4].map((id) => ({ id, properties: [{ name: 'terrain', value: 'sand' }] })),
    ...[5, 6, 7, 8].map((id) => ({ id, properties: [{ name: 'terrain', value: 'road' }] })),
    { id: 9, properties: [{ name: 'terrain', value: 'rock' }] },
    { id: 10, properties: [{ name: 'solid', value: true }] },
  ],
};
const PUBLIC = new URL('../public/', import.meta.url);
const elevationTsj = JSON.parse(readFileSync(new URL('maps/shared/elevation.tsj', PUBLIC), 'utf8'));

const W = 30;
const H = 17;
const fill = (ch: string) => Array.from({ length: H }, () => ch.repeat(W));
/** `rows` with row `y` replaced at column `x` by `s`. */
const put = (rows: string[], x: number, y: number, s: string) =>
  rows.map((r, i) => (i === y ? r.slice(0, x) + s + r.slice(x + s.length) : r));

const flat = (extra: Partial<ChunkLayout> = {}): ChunkLayout =>
  chunk({ ground: fill('.'), elev: fill('0'), ...extra });

function parse(json: unknown) {
  const map = embedTilesets(json as TiledMap, (src) =>
    src.endsWith('elevation.tsj') ? elevationTsj : tinyTileset,
  );
  return parseChunkGrid(map as unknown as GridMap);
}

describe('parseElevation', () => {
  it('reads levels, with . as level 0', () => {
    const cells = parseElevation(put(fill('.'), 3, 2, '2'));
    expect(cells[2 * W + 3]).toEqual({ level: 2, ramp: null, steep: false });
    expect(cells[0]).toEqual({ level: 0, ramp: null, steep: false });
  });

  it('gives a ramp the level behind it, or one below the level in front of it', () => {
    let rows = fill('1');
    rows = put(rows, 5, 5, '2');
    rows = put(rows, 5, 6, 'n'); // behind (south) is level 1
    rows = put(rows, 8, 5, 'E2'); // behind (west) is level 1, steep
    rows = put(rows, 0, 10, 'w'); // behind (east) is level 1, though in front is the map edge
    const cells = parseElevation(rows);
    expect(cells[6 * W + 5]).toEqual({ level: 1, ramp: 'n', steep: false });
    expect(cells[5 * W + 8]).toEqual({ level: 1, ramp: 'e', steep: true });
    expect(cells[10 * W + 0]).toEqual({ level: 1, ramp: 'w', steep: false });
  });

  it('follows runs of ramp cells', () => {
    let rows = fill('0');
    for (let y = 4; y <= 6; y++) rows = put(rows, 10, y, 'n');
    rows = put(rows, 10, 3, '1');
    const cells = parseElevation(rows);
    for (let y = 4; y <= 6; y++) expect(cells[y * W + 10]!.level).toBe(0);
  });

  it('uses the level in front when the ramp starts at the map edge', () => {
    let rows = fill('2');
    rows = put(rows, 4, 16, 'n');
    rows = put(rows, 4, 15, '3');
    expect(parseElevation(rows)[16 * W + 4]!.level).toBe(2);
  });

  it('rejects bad characters, sizes and ramps it cannot place', () => {
    expect(() => parseElevation(put(fill('0'), 1, 1, 'x'))).toThrow(/row 1.*"x"/);
    expect(() => parseElevation(fill('0').slice(1))).toThrow(/17 rows/);
    expect(() => parseElevation(put(fill('0'), 0, 0, '0000'.repeat(9)))).toThrow(/30/);
    // A lone ramp climbing from 0 to 2 has no consistent level.
    let rows = fill('0');
    rows = put(rows, 5, 5, 'n');
    rows = put(rows, 5, 4, '2');
    expect(() => parseElevation(rows)).toThrow(/ramp at \(5, 5\)/);
  });
});

describe('buildWorld', () => {
  const one = (layout: ChunkLayout) =>
    buildWorld('tiny', new Map([['x00_y00', layout]]), palette).maps.get('tiny_x00_y00.tmj')!;

  it('writes 30×17 chunks with the LEVEL_DESIGN layers in order, elevation hidden', () => {
    const map = one(flat()) as TiledMap & {
      layers: { name: string; visible: boolean; data?: number[] }[];
    };
    expect([map.width, map.height]).toEqual([W, H]);
    expect(map.layers.map((l) => l.name)).toEqual([
      'ground',
      'elevation',
      'walls',
      'decor',
      'above',
      'objects',
    ]);
    expect(map.layers.find((l) => l.name === 'elevation')!.visible).toBe(false);
    expect(map.tilesets).toEqual([
      { firstgid: 1, source: 'tiny.tsj' },
      { firstgid: 41, source: '../shared/elevation.tsj' },
    ]);
  });

  it('round-trips terrain, levels, ramps and walls through the grid parser', () => {
    let ground = put(fill('.'), 0, 0, '##');
    ground = put(ground, 4, 4, '===');
    let elev = put(fill('0'), 10, 5, '111');
    elev = put(elev, 10, 6, 'nnN');
    const cells = parse(one(flat({ ground, elev }))).cells;
    expect(cells[0]).toMatchObject({ solid: true, terrain: 'rock' });
    expect(cells[4 * W + 5]).toMatchObject({ terrain: 'road', solid: false });
    expect(cells[5 * W + 10]).toMatchObject({ level: 1, ramp: null });
    expect(cells[6 * W + 10]).toMatchObject({ level: 0, ramp: 'n', steep: false });
    expect(cells[6 * W + 12]).toMatchObject({ level: 0, ramp: 'n', steep: true });
  });

  it('shades ground per level', () => {
    const map = one(flat({ elev: put(fill('0'), 3, 3, '2') })) as { layers: { data: number[] }[] };
    expect(map.layers[0]!.data[3 * W + 3]).toBe(1 + 3);
  });

  it('draws a rim on the edges of high cells, but not toward the ramp that climbs to them', () => {
    let elev = put(fill('0'), 10, 5, '111');
    elev = put(elev, 10, 6, '.n.');
    const map = one(flat({ elev })) as { layers: { name: string; data: number[] }[] };
    const walls = map.layers.find((l) => l.name === 'walls')!.data;
    const rimAt = (x: number, y: number) => walls[y * W + x]! - 1 - 19;
    expect(rimAt(10, 5)).toBe(RIM.n | RIM.s | RIM.w);
    expect(rimAt(11, 5)).toBe(RIM.n);
    expect(rimAt(12, 5)).toBe(RIM.n | RIM.s | RIM.e);
    // The ramp cell gets the ramp overlay instead.
    expect(walls[6 * W + 11]).toBe(1 + 11);
  });

  it('sees neighbouring chunks when drawing rims, and skips rims against walls', () => {
    const left = flat({ elev: put(fill('0'), 29, 8, '1'), ground: put(fill('.'), 28, 8, '#') });
    const right = flat();
    const { maps } = buildWorld(
      'tiny',
      new Map([
        ['x00_y00', left],
        ['x01_y00', right],
      ]),
      palette,
    );
    const walls = (maps.get('tiny_x00_y00.tmj') as { layers: { data: number[] }[] }).layers[2]!
      .data;
    // East edge faces level 0 in the next chunk; west faces a wall.
    expect(walls[8 * W + 29]! - 1 - 19).toBe(RIM.n | RIM.s | RIM.e);
  });

  it('places decor (including multi-tile blocks) and above tiles', () => {
    let decor = put(fill('.'), 2, 2, 't');
    decor = put(decor, 5, 5, 'W');
    const above = put(fill('.'), 7, 7, 'N');
    const map = one(flat({ decor, above })) as { layers: { name: string; data: number[] }[] };
    const d = map.layers.find((l) => l.name === 'decor')!.data;
    expect(d[2 * W + 2]).toBe(36);
    expect([d[5 * W + 5], d[5 * W + 6], d[6 * W + 5], d[6 * W + 6]]).toEqual([37, 38, 39, 40]);
    expect(map.layers.find((l) => l.name === 'above')!.data[7 * W + 7]).toBe(35);
  });

  it('scatters decor deterministically, only on the scatter ground and away from walls layer', () => {
    const layout = flat({ ground: put(fill('='), 0, 0, '.'.repeat(30)) });
    const a = JSON.stringify(one(layout));
    expect(JSON.stringify(one(layout))).toBe(a);
    const d = (JSON.parse(a) as { layers: { name: string; data: number[] }[] }).layers.find(
      (l) => l.name === 'decor',
    )!.data;
    expect(d.slice(0, W).some((g) => g === 36)).toBe(true);
    expect(d.slice(W).every((g) => g === 0)).toBe(true);
  });

  it('numbers objects and types their properties', () => {
    const objects = [
      spawn('start', 15, 8),
      depot('depot_a', 4, 4),
      pickup('mortar', { ability: 'mortar' }, 20, 3),
      enemy('technical', 0, 22, 10, { patrol: 'loop', facing: 90 }),
      path('loop', [
        [20, 10],
        [25, 10],
        [20, 10],
      ]),
    ];
    const map = one(flat({ objects })) as {
      nextobjectid: number;
      layers: { name: string; objects?: Record<string, unknown>[] }[];
    };
    const out = map.layers.find((l) => l.name === 'objects')!.objects!;
    expect(out.map((o) => o.id)).toEqual([1, 2, 3, 4, 5]);
    expect(map.nextobjectid).toBe(6);
    expect(out[0]).toMatchObject({ type: 'spawn', name: 'start', x: 248, y: 136, point: true });
    expect(out[1]).toMatchObject({ type: 'depot', x: 48, y: 48, width: 32, height: 32 });
    expect(out[3]!.properties).toEqual([
      { name: 'enemyType', type: 'string', value: 'technical' },
      { name: 'level', type: 'int', value: 0 },
      { name: 'patrol', type: 'string', value: 'loop' },
    ]);
    expect(out[3]!.rotation).toBe(90);
    expect(out[4]).toMatchObject({
      name: 'loop',
      polyline: [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 0, y: 0 },
      ],
    });
  });

  it('rejects unknown ground and decor characters and bad grids, naming the chunk', () => {
    expect(() => one(flat({ ground: put(fill('.'), 3, 1, '?') }))).toThrow(/x00_y00.*ground.*"\?"/);
    expect(() => one(flat({ decor: put(fill('.'), 3, 1, '?') }))).toThrow(/x00_y00.*decor.*"\?"/);
    expect(() => one(flat({ ground: fill('.').slice(2) }))).toThrow(/x00_y00.*17 rows/);
    expect(() => one(flat({ decor: put(fill('.'), 29, 1, 'W') }))).toThrow(/x00_y00.*decor/);
  });

  it('writes a .world listing every chunk at its offset', () => {
    const { world } = buildWorld(
      'tiny',
      new Map([
        ['x01_y02', flat()],
        ['x00_y00', flat()],
      ]),
      palette,
    );
    expect(world).toEqual({
      maps: [
        { fileName: 'tiny_x00_y00.tmj', height: 272, width: 480, x: 0, y: 0 },
        { fileName: 'tiny_x01_y02.tmj', height: 272, width: 480, x: 480, y: 544 },
      ],
      onlyShowAdjacentMaps: false,
      type: 'world',
    });
  });

  it('resolves tileset paths relative to the chunk like the game does', () => {
    expect(resolveRelativePath('maps/tiny/tiny_x00_y00.tmj', '../shared/elevation.tsj')).toBe(
      'maps/shared/elevation.tsj',
    );
  });
});

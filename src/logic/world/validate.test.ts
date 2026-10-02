import { describe, expect, it } from 'vitest';
import { CHUNK_H, CHUNK_W } from './chunks';
import {
  formatIssue,
  validateStandaloneMap,
  validateTileset,
  validateWorlds,
  type KnownIds,
  type MapIssue,
} from './validate';

const known: KnownIds = {
  imageAssets: new Map([
    ['tiles_a', 'assets/a.png'],
    ['tiles_elevation', 'assets/elevation.png'],
  ]),
  messageKeys: new Set(['radio.test.hello']),
};

const prop = (name: string, value: unknown) => ({
  name,
  type: typeof value === 'number' ? 'int' : typeof value === 'boolean' ? 'bool' : 'string',
  value,
});

/** Tileset A (firstgid 1): 0 sand, 1 solid, 2 road. Elevation (firstgid 10): 0 level 0, 1 level 1, 2 ramp e. */
const tilesetA = {
  name: 'tiles_a',
  image: '../../assets/a.png',
  tilecount: 3,
  tiles: [
    { id: 0, properties: [prop('terrain', 'sand')] },
    { id: 1, properties: [prop('solid', true)] },
    { id: 2, properties: [prop('terrain', 'road')] },
  ],
};
const elevation = {
  name: 'tiles_elevation',
  image: '../../assets/elevation.png',
  tilecount: 3,
  tiles: [
    { id: 0, properties: [prop('level', 0)] },
    { id: 1, properties: [prop('level', 1)] },
    { id: 2, properties: [prop('level', 0), prop('ramp', 'e')] },
  ],
};
const TILESETS = [
  { firstgid: 1, source: 'tiles.tsj' },
  { firstgid: 10, source: '../shared/elevation.tsj' },
];

type Obj = {
  id: number;
  name?: string;
  type: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  polyline?: { x: number; y: number }[];
  properties?: unknown[];
};

function chunk(opts: { elevation?: number[]; walls?: number[]; objects?: Obj[] } = {}) {
  const n = CHUNK_W * CHUNK_H;
  const tile = (name: string, data?: number[], visible = true) => ({
    name,
    type: 'tilelayer',
    width: CHUNK_W,
    height: CHUNK_H,
    visible,
    data: data ?? new Array<number>(n).fill(name === 'ground' ? 1 : 0),
  });
  return {
    width: CHUNK_W,
    height: CHUNK_H,
    tilewidth: 16,
    tileheight: 16,
    tilesets: TILESETS,
    layers: [
      tile('ground'),
      tile('elevation', opts.elevation, false),
      tile('walls', opts.walls),
      tile('decor'),
      tile('above'),
      {
        name: 'objects',
        type: 'objectgroup',
        visible: true,
        objects: (opts.objects ?? []).map((o) => ({ x: 8, y: 8, name: '', ...o })),
      },
    ],
  };
}

const WORLD = 'maps/t/t.world';

function files(chunks: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const maps = Object.keys(chunks).map((id) => {
    const [, x, y] = /_x(\d+)_y(\d+)/.exec(id)!;
    return { fileName: `${id}.tmj`, x: Number(x) * 480, y: Number(y) * 272 };
  });
  const all: Record<string, unknown> = {
    [WORLD]: { type: 'world', maps },
    'maps/t/tiles.tsj': tilesetA,
    'maps/shared/elevation.tsj': elevation,
    ...Object.fromEntries(Object.entries(chunks).map(([id, c]) => [`maps/t/${id}.tmj`, c])),
    ...extra,
  };
  return (path: string) => all[path];
}

const run = (chunks: Record<string, unknown>, extra?: Record<string, unknown>) =>
  validateWorlds([WORLD], files(chunks, extra), known);

const messages = (issues: MapIssue[]) => issues.map((i) => i.message);

/** Column/row-major helpers for 30×17 layers. */
const fill = (value: number, where: (x: number, y: number) => boolean) => {
  const data = new Array<number>(CHUNK_W * CHUNK_H).fill(0);
  for (let y = 0; y < CHUNK_H; y++)
    for (let x = 0; x < CHUNK_W; x++) if (where(x, y)) data[y * CHUNK_W + x] = value;
  return data;
};

describe('validateWorlds: structure', () => {
  it('accepts a valid two-chunk world', () => {
    expect(run({ t_x00_y00: chunk(), t_x01_y00: chunk() })).toEqual([]);
  });

  it('reports a chunk file that does not exist', () => {
    const load = files({ t_x00_y00: chunk() });
    const world = {
      maps: [
        { fileName: 't_x00_y00.tmj', x: 0, y: 0 },
        { fileName: 't_x01_y00.tmj', x: 480, y: 0 },
      ],
    };
    const issues = validateWorlds([WORLD], (p) => (p === WORLD ? world : load(p)), known);
    expect(issues).toContainEqual(
      expect.objectContaining({ file: 'maps/t/t_x01_y00.tmj', message: 'missing chunk file' }),
    );
  });

  it('reports chunk offsets that are not chunk multiples', () => {
    const issues = validateWorlds(
      [WORLD],
      (p) => (p === WORLD ? { maps: [{ fileName: 't_x00_y00.tmj', x: 16, y: 0 }] } : undefined),
      known,
    );
    expect(issues[0]!.message).toMatch(/not a multiple of the chunk size/);
  });

  it('reports chunk names that do not match their position', () => {
    const load = files({ t_x00_y00: chunk() });
    const issues = validateWorlds(
      [WORLD],
      (p) => (p === WORLD ? { maps: [{ fileName: 't_x00_y00.tmj', x: 480, y: 0 }] } : load(p)),
      known,
    );
    expect(messages(issues)).toContain('chunk at (1, 0) must be named t_x01_y00');
  });

  it('reports the wrong chunk size', () => {
    const small = { ...chunk(), width: 20 };
    expect(messages(run({ t_x00_y00: small }))).toContain('chunk is 20×17, expected 30×17');
  });

  it('reports layers out of order and a visible elevation layer', () => {
    const c = chunk();
    const swapped = { ...c, layers: [c.layers[1], c.layers[0], ...c.layers.slice(2)] };
    expect(messages(run({ t_x00_y00: swapped }))).toContain(
      'layers must be ground, elevation, walls, decor, above, objects',
    );
    const visible = chunk();
    (visible.layers[1] as { visible: boolean }).visible = true;
    expect(run({ t_x00_y00: visible })).toContainEqual(
      expect.objectContaining({ layer: 'elevation', message: 'must be hidden' }),
    );
  });

  it('reports embedded and unresolvable tilesets', () => {
    const embedded = { ...chunk(), tilesets: [{ firstgid: 1, name: 'tiles_a', tiles: [] }] };
    expect(messages(run({ t_x00_y00: embedded }))).toContain(
      'tileset "tiles_a" must be an external .tsj',
    );
    const missing = { ...chunk(), tilesets: [{ firstgid: 1, source: 'nope.tsj' }] };
    expect(messages(run({ t_x00_y00: missing }))).toContain('tileset nope.tsj not found');
  });

  it('reports gids that no tileset covers', () => {
    const c = chunk({ walls: fill(99, (x, y) => x === 0 && y === 0) });
    expect(run({ t_x00_y00: c })).toContainEqual(
      expect.objectContaining({ layer: 'walls', message: 'unknown tile gid 99 at (0, 0)' }),
    );
  });
});

describe('validateTileset', () => {
  it('accepts a known tileset', () => {
    expect(validateTileset('maps/t/tiles.tsj', tilesetA, known)).toEqual([]);
  });

  it('requires the name to be a manifest image key with the same image', () => {
    expect(messages(validateTileset('maps/t/x.tsj', { ...tilesetA, name: 'nope' }, known))).toEqual(
      ['name "nope" is not an image key in the asset manifest'],
    );
    expect(
      messages(
        validateTileset('maps/t/x.tsj', { ...tilesetA, image: '../../assets/b.png' }, known),
      ),
    ).toEqual(['image assets/b.png does not match the manifest path assets/a.png for tiles_a']);
  });

  it('rejects unknown property values', () => {
    const bad = {
      ...tilesetA,
      tiles: [
        { id: 0, properties: [prop('terrain', 'lava')] },
        { id: 1, properties: [prop('level', 7)] },
        { id: 2, properties: [prop('ramp', 'up')] },
        { id: 3, properties: [prop('steep', 'yes')] },
      ],
    };
    expect(messages(validateTileset('maps/t/x.tsj', bad, known))).toEqual([
      'tile 0: unknown terrain "lava"',
      'tile 1: level must be an integer 0–3, got 7',
      'tile 2: ramp must be n, s, e or w, got "up"',
      'tile 3: steep must be a boolean',
    ]);
  });
});

describe('validateWorlds: objects', () => {
  const withObjects = (objects: Obj[]) => run({ t_x00_y00: chunk({ objects }) });

  it('accepts well-formed objects', () => {
    expect(
      withObjects([
        { id: 1, type: 'spawn', name: 'start' },
        { id: 2, type: 'pickup', properties: [prop('ability', 'mortar'), prop('id', 'p1')] },
        { id: 3, type: 'pickup', properties: [prop('minor', 'armor_plate'), prop('id', 'p2')] },
        { id: 4, type: 'switch', properties: [prop('id', 's1'), prop('activatedBy', 'mortar')] },
        {
          id: 5,
          type: 'door',
          width: 16,
          height: 48,
          properties: [prop('id', 'd1'), prop('opensWith', 's1')],
        },
        { id: 6, type: 'radio', properties: [prop('messageKey', 'radio.test.hello')] },
        { id: 7, type: 'depot', properties: [prop('id', 'depot_1')] },
        { id: 8, type: 'mk_upgrade', properties: [prop('tier', 'mk3')] },
        { id: 9, type: 'zone', properties: [prop('kind', 'sensor')] },
      ]),
    ).toEqual([]);
  });

  it('reports unknown types and bad or missing properties', () => {
    const issues = withObjects([
      { id: 1, type: 'teleporter' },
      { id: 2, type: 'pickup', properties: [prop('ability', 'jetpack'), prop('id', 'p1')] },
      { id: 3, type: 'pickup', properties: [prop('ability', 'mortar')] },
      { id: 4, type: 'switch', properties: [prop('id', 's1'), prop('activatedBy', 'magic')] },
      { id: 5, type: 'radio', properties: [prop('messageKey', 'radio.nope')] },
      { id: 6, type: 'spawn' },
      { id: 7, type: 'mk_upgrade', properties: [prop('tier', 'mk9')] },
    ]);
    expect(issues.map((i) => `${i.object} ${i.message}`)).toEqual([
      '#1 unknown object type "teleporter"',
      '#2 unknown ability "jetpack"',
      '#3 missing property "id"',
      '#4 activatedBy must be one of cannon, mortar, scout, drone, lahat, remote, got "magic"',
      '#5 unknown message key "radio.nope"',
      '#6 spawn needs a name',
      '#7 unknown tier "mk9"',
    ]);
  });

  it('checks destructible materials against data/materials.ts', () => {
    const d = (id: number, material: string): Obj => ({
      id,
      type: 'destructible',
      properties: [prop('material', material), prop('id', `d${id}`)],
    });
    const issues = withObjects([d(1, 'sandbag'), d(2, 'armored'), d(3, 'jelly')]);
    expect(issues.map((i) => `${i.object} ${i.message}`)).toEqual(['#3 unknown material "jelly"']);
  });

  it('checks enemy types against data/enemies.ts and wants an integer level', () => {
    const e = (id: number, enemyType: string, level: unknown): Obj => ({
      id,
      type: 'enemy',
      properties: [prop('enemyType', enemyType), prop('level', level)],
    });
    const issues = withObjects([e(1, 'technical', 0), e(2, 'dragon', 0), e(3, 'light_tank', 1.5)]);
    expect(issues.map((i) => `${i.object} ${i.message}`)).toEqual([
      '#2 unknown enemy type "dragon"',
      '#3 level must be an integer 0–3, got 1.5',
    ]);
  });

  it('accepts patrol polylines and checks that enemy patrols name one in the chunk', () => {
    const line: Obj = { id: 5, name: 'loop', type: '', polyline: [{ x: 0, y: 0 }] };
    const e = (id: number, patrol: string): Obj => ({
      id,
      type: 'enemy',
      properties: [prop('enemyType', 'technical'), prop('level', 0), prop('patrol', patrol)],
    });
    const issues = withObjects([line, e(1, 'loop'), e(2, 'nowhere')]);
    expect(issues.map((i) => `${i.object} ${i.message}`)).toEqual([
      '#2 patrol "nowhere" is not a polyline here',
    ]);
  });

  it('reports duplicate persistent ids and doors without their switch', () => {
    const issues = withObjects([
      { id: 1, type: 'depot', properties: [prop('id', 'a')] },
      { id: 2, type: 'boulder', properties: [prop('id', 'a')] },
      {
        id: 3,
        type: 'door',
        width: 16,
        height: 16,
        properties: [prop('id', 'd1'), prop('opensWith', 's9')],
      },
    ]);
    expect(messages(issues)).toEqual(['duplicate id "a"', 'opensWith "s9" is not a switch here']);
  });

  it('wants doors drawn as rectangles', () => {
    const issues = withObjects([
      { id: 1, type: 'switch', properties: [prop('id', 's1'), prop('activatedBy', 'cannon')] },
      { id: 2, type: 'door', properties: [prop('id', 'd1'), prop('opensWith', 's1')] },
    ]);
    expect(issues.map((i) => `${i.object} ${i.message}`)).toEqual([
      '#2 door must be a rectangle (it blocks the cells it covers)',
    ]);
  });

  it('checks exits against the worlds and their spawns', () => {
    const target = chunk({ objects: [{ id: 1, type: 'spawn', name: 'gate' }] });
    const exit = (toBiome: string, toChunk: string, toSpawn: string): Obj => ({
      id: 1,
      type: 'exit',
      properties: [prop('toBiome', toBiome), prop('toChunk', toChunk), prop('toSpawn', toSpawn)],
    });
    const check = (o: Obj) =>
      messages(run({ t_x00_y00: chunk({ objects: [o] }), t_x01_y00: target }));
    expect(check(exit('t', 't_x01_y00', 'gate'))).toEqual([]);
    expect(check(exit('hills', 't_x01_y00', 'gate'))).toEqual(['exit to unknown biome "hills"']);
    expect(check(exit('t', 't_x05_y00', 'gate'))).toEqual(['exit to unknown chunk "t_x05_y00"']);
    expect(check(exit('t', 't_x01_y00', 'dock'))).toEqual([
      'exit to unknown spawn "dock" in t_x01_y00',
    ]);
  });
});

describe('validateWorlds: chunk edges', () => {
  // Column 29 of x00 faces column 0 of x01.
  const eastEdge = (gid: number) => fill(gid, (x) => x === CHUNK_W - 1);
  const westEdge = (gid: number) => fill(gid, (x) => x === 0);

  it('reports cells that change level across a chunk edge', () => {
    const issues = run({ t_x00_y00: chunk(), t_x01_y00: chunk({ elevation: westEdge(11) }) });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      file: 'maps/t/t_x01_y00.tmj',
      layer: 'elevation',
      message: 'level 1 at (0, 0) does not match level 0 across the edge with t_x00_y00',
    });
  });

  it('allows a ramp across the edge, or a wall on either side', () => {
    expect(
      run({
        t_x00_y00: chunk({ elevation: eastEdge(12) }),
        t_x01_y00: chunk({ elevation: westEdge(11) }),
      }),
    ).toEqual([]);
    expect(
      run({
        t_x00_y00: chunk({ walls: eastEdge(2) }),
        t_x01_y00: chunk({ elevation: westEdge(11) }),
      }),
    ).toEqual([]);
  });
});

describe('validateStandaloneMap', () => {
  it('skips the chunk-size rule but checks the rest', () => {
    const load = files({});
    const map = { ...chunk({ objects: [{ id: 1, type: 'nope' }] }), width: 60, height: 34 };
    const issues = validateStandaloneMap('maps/t/room.tmj', map, load, known);
    expect(messages(issues)).toEqual(['unknown object type "nope"']);
  });
});

describe('formatIssue', () => {
  it('prints file:layer:object and the reason', () => {
    expect(
      formatIssue({ file: 'maps/a.tmj', layer: 'objects', object: '#3', message: 'bad' }),
    ).toBe('maps/a.tmj:objects:#3 bad');
    expect(formatIssue({ file: 'maps/a.world', message: 'bad' })).toBe('maps/a.world bad');
  });
});

describe('validateWorlds: progression reachability (rule 6)', () => {
  it('reports a pickup walled off from the start', () => {
    // A solid column at x = 10 splits the chunk; the pickup is east of it.
    const c = chunk({
      walls: fill(2, (x) => x === 10),
      objects: [
        { id: 1, type: 'spawn', name: 'start', x: 40, y: 40 },
        {
          id: 2,
          type: 'pickup',
          x: 300,
          y: 40,
          properties: [prop('ability', 'mortar'), prop('id', 'm')],
        },
      ],
    });
    expect(run({ t_x00_y00: c })).toEqual([
      expect.objectContaining({
        file: 'maps/t/t_x00_y00.tmj',
        layer: 'objects',
        object: '#2',
        message: expect.stringMatching(/pickup "m" is unreachable/) as unknown,
      }),
    ]);
  });
});

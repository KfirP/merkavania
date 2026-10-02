import { describe, expect, it } from 'vitest';
import { CHUNK_H, CHUNK_W, TILE } from './chunks';
import type { Cell, ChunkGrid } from './grid';
import type { RawObject } from './objects';
import { checkReachability, type ReachChunk } from './reachability';

/** One 30×17 chunk of open level-0 sand inside a solid border, with per-cell overrides. */
function grid(overrides: Record<string, Partial<Cell>> = {}): ChunkGrid {
  const cells: Cell[] = [];
  for (let y = 0; y < CHUNK_H; y++)
    for (let x = 0; x < CHUNK_W; x++) {
      const border = x === 0 || y === 0 || x === CHUNK_W - 1 || y === CHUNK_H - 1;
      cells.push({
        level: 0,
        ramp: null,
        steep: false,
        terrain: 'sand',
        solid: border,
        ...overrides[`${x},${y}`],
      });
    }
  return { width: CHUNK_W, height: CHUNK_H, cells };
}

/** Overrides for every cell in columns x0..x1 (inclusive), all rows. */
function columns(x0: number, x1: number, cell: Partial<Cell>): Record<string, Partial<Cell>> {
  const out: Record<string, Partial<Cell>> = {};
  for (let x = x0; x <= x1; x++) for (let y = 0; y < CHUNK_H; y++) out[`${x},${y}`] = cell;
  return out;
}

/** Overrides for the cells in x0..x1 × y0..y1 (inclusive). */
function rect(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  cell: Partial<Cell>,
): Record<string, Partial<Cell>> {
  const out: Record<string, Partial<Cell>> = {};
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out[`${x},${y}`] = cell;
  return out;
}

const props = (p: Record<string, unknown>) =>
  Object.entries(p).map(([name, value]) => ({ name, value }));
/** A point object at the centre of tile (tx, ty). */
const at = (tx: number, ty: number) => ({ x: tx * TILE + 8, y: ty * TILE + 8 });

let nextId = 1;
const start = (tx: number, ty: number): RawObject => ({
  id: nextId++,
  type: 'spawn',
  name: 'start',
  ...at(tx, ty),
});
const pickup = (id: string, tx: number, ty: number, kind: Record<string, string>): RawObject => ({
  id: nextId++,
  type: 'pickup',
  ...at(tx, ty),
  properties: props({ id, ...kind }),
});
const depot = (id: string, tx: number, ty: number): RawObject => ({
  id: nextId++,
  type: 'depot',
  ...at(tx, ty),
  properties: props({ id }),
});
const switchAt = (id: string, by: string, tx: number, ty: number): RawObject => ({
  id: nextId++,
  type: 'switch',
  ...at(tx, ty),
  properties: props({ id, activatedBy: by }),
});
/** A door filling column `tx`, rows 1..15. */
const door = (id: string, opensWith: string, tx: number): RawObject => ({
  id: nextId++,
  type: 'door',
  x: tx * TILE,
  y: TILE,
  width: TILE,
  height: (CHUNK_H - 2) * TILE,
  properties: props({ id, opensWith }),
});

function world(g: ChunkGrid, objects: RawObject[]): ReachChunk[] {
  return [
    { chunk: { id: 'w_x00_y00', path: 'maps/w/w_x00_y00.tmj', cx: 0, cy: 0 }, grid: g, objects },
  ];
}

const messages = (chunks: ReachChunk[]) => checkReachability(chunks).map((i) => i.message);

describe('checkReachability', () => {
  it('passes when everything is on open ground', () => {
    const objs = [start(2, 8), pickup('p', 20, 8, { ability: 'mortar' }), depot('d', 10, 8)];
    expect(checkReachability(world(grid(), objs))).toEqual([]);
  });

  it('reports a pickup sealed behind walls, at its object', () => {
    const g = grid(columns(15, 15, { solid: true }));
    const p = pickup('sealed', 20, 8, { minor: 'armor_plate' });
    const issues = checkReachability(world(g, [start(2, 8), p]));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ file: 'maps/w/w_x00_y00.tmj', layer: 'objects' });
    expect(issues[0]!.object).toBe(`#${p.id}`);
    expect(issues[0]!.message).toMatch(/pickup "sealed".*unreachable/);
  });

  it('reports a pickup locked behind its own gate', () => {
    const g = grid(columns(15, 15, { terrain: 'rubble' }));
    const objs = [start(2, 8), pickup('dozer', 20, 8, { ability: 'dozer_blade' })];
    expect(messages(world(g, objs))).toEqual([
      expect.stringMatching(/pickup "dozer".*unreachable/),
    ]);
  });

  it('collects abilities in dependency order', () => {
    // rubble at 10, mud at 20: dozer before the rubble, wide tracks between, depot past the mud.
    const g = grid({
      ...columns(10, 10, { terrain: 'rubble' }),
      ...columns(20, 20, { terrain: 'mud' }),
    });
    const objs = [
      start(2, 8),
      pickup('dozer', 5, 8, { ability: 'dozer_blade' }),
      pickup('tracks', 15, 8, { ability: 'wide_tracks' }),
      depot('far', 25, 8),
    ];
    expect(checkReachability(world(g, objs))).toEqual([]);
  });

  it('opens a door with a cannon switch the tank can see and shoot', () => {
    const objs = [
      start(2, 8),
      switchAt('s', 'cannon', 8, 3),
      door('gate', 's', 15),
      depot('behind', 25, 8),
    ];
    expect(checkReachability(world(grid(), objs))).toEqual([]);
  });

  it('keeps a door shut when its switch is out of reach of its activator', () => {
    // The scout switch needs hatch_scout, which nobody has.
    const objs = [
      start(2, 8),
      switchAt('s', 'scout', 8, 3),
      door('gate', 's', 15),
      depot('behind', 25, 8),
    ];
    expect(messages(world(grid(), objs))).toEqual([
      expect.stringMatching(/depot "behind".*unreachable/),
    ]);
  });

  it('a mortar switch on a cliff top needs the mortar', () => {
    // A level-1 block with no ramp; the switch sits on it.
    const g = grid(rect(8, 12, 6, 10, { level: 1 }));
    const base = [start(2, 8), switchAt('s', 'mortar', 10, 8), door('gate', 's', 20)];
    expect(messages(world(g, [...base, depot('behind', 25, 8)]))).toEqual([
      expect.stringMatching(/depot "behind".*unreachable/),
    ]);
    const withMortar = [...base, pickup('m', 4, 3, { ability: 'mortar' }), depot('behind', 25, 8)];
    expect(checkReachability(world(g, withMortar))).toEqual([]);
  });

  it('a scout switch counts once the scout can crawl to it', () => {
    // The switch sits in a walled pocket (cols 18..23, rows 1..4) whose way in is a crawlspace.
    const g = grid({
      ...rect(18, 23, 4, 4, { solid: true }),
      ...rect(18, 18, 1, 3, { solid: true }),
      ...rect(23, 23, 1, 3, { solid: true }),
      '21,4': { solid: false, terrain: 'crawlspace' },
    });
    const objs = [
      start(2, 8),
      pickup('hatch', 5, 8, { ability: 'hatch_scout' }),
      switchAt('s', 'scout', 20, 2),
      door('gate', 's', 25),
      depot('behind', 27, 8),
    ];
    expect(checkReachability(world(g, objs))).toEqual([]);
  });

  it('an mk_upgrade grants its signature ability', () => {
    // Level 1 from column 16 on, reached only by a steep ramp at column 15.
    const g = grid({
      ...columns(16, 28, { level: 1 }),
      ...columns(15, 15, { level: 0, ramp: 'e', steep: true }),
    });
    const upgrade: RawObject = {
      id: nextId++,
      type: 'mk_upgrade',
      ...at(5, 8),
      properties: props({ tier: 'mk3' }),
    };
    const objs = [start(2, 8), upgrade, depot('shelf', 25, 8)];
    expect(checkReachability(world(g, objs))).toEqual([]);
    expect(messages(world(g, [start(2, 8), depot('shelf', 25, 8)]))).toHaveLength(1);
  });

  it('skips a world without a start spawn (other biomes are entered through exits)', () => {
    expect(checkReachability(world(grid(), [depot('d', 5, 5)]))).toEqual([]);
  });
});

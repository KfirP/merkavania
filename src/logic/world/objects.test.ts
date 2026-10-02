import { describe, expect, it } from 'vitest';
import { CHUNK_PX_H, CHUNK_PX_W } from './chunks';
import { findDepot, parseChunkObjects, type RawObject } from './objects';

const chunk = { id: 'test_x01_y02', cx: 1, cy: 2 };
const ox = CHUNK_PX_W;
const oy = CHUNK_PX_H * 2;
const props = (p: Record<string, unknown>) =>
  Object.entries(p).map(([name, value]) => ({ name, value }));

describe('parseChunkObjects', () => {
  it('turns destructible rects into world-space centres keyed <chunkId>:<id>', () => {
    const raw: RawObject[] = [
      {
        id: 3,
        type: 'destructible',
        x: 32,
        y: 48,
        width: 16,
        height: 16,
        properties: props({ material: 'sandbag', id: 'bags1' }),
      },
    ];
    expect(parseChunkObjects(chunk, raw)).toMatchObject({
      enemies: [],
      destructibles: [
        {
          key: 'test_x01_y02:bags1',
          material: 'sandbag',
          x: ox + 40,
          y: oy + 56,
          width: 16,
          height: 16,
        },
      ],
    });
  });

  it('parses enemies with their level and patrol polyline (by name)', () => {
    const raw: RawObject[] = [
      {
        id: 7,
        type: 'enemy',
        x: 100,
        y: 50,
        properties: props({ enemyType: 'technical', level: 1, patrol: 'loop' }),
      },
      {
        id: 8,
        name: 'loop',
        x: 10,
        y: 20,
        polyline: [
          { x: 0, y: 0 },
          { x: 30, y: 0 },
        ],
      },
    ];
    const { enemies } = parseChunkObjects(chunk, raw);
    expect(enemies).toEqual([
      {
        key: 'test_x01_y02:7',
        enemyType: 'technical',
        level: 1,
        x: ox + 100,
        y: oy + 50,
        facing: 0,
        patrol: [
          { x: ox + 10, y: oy + 20 },
          { x: ox + 40, y: oy + 20 },
        ],
      },
    ]);
  });

  it('reads the enemy facing from the Tiled rotation (degrees clockwise, 0 = east)', () => {
    const raw: RawObject[] = [
      {
        id: 4,
        type: 'enemy',
        x: 0,
        y: 0,
        rotation: 180,
        properties: props({ enemyType: 'bunker_mg', level: 0 }),
      },
    ];
    expect(parseChunkObjects(chunk, raw).enemies[0]?.facing).toBeCloseTo(Math.PI);
  });

  it('ignores other object types and enemies whose patrol is missing keep no patrol', () => {
    const raw: RawObject[] = [
      { id: 1, type: 'spawn', name: 'start', x: 0, y: 0 },
      {
        id: 2,
        type: 'enemy',
        x: 0,
        y: 0,
        properties: props({ enemyType: 'rifle_squad', level: 0, patrol: 'nope' }),
      },
    ];
    const parsed = parseChunkObjects(chunk, raw);
    expect(parsed.destructibles).toEqual([]);
    expect(parsed.enemies[0]?.patrol).toBeUndefined();
  });

  it('parses pickups (ability or minor) at their centre', () => {
    const raw: RawObject[] = [
      { id: 1, type: 'pickup', x: 16, y: 16, properties: props({ id: 'p1', ability: 'mortar' }) },
      {
        id: 2,
        type: 'pickup',
        x: 64,
        y: 32,
        width: 16,
        height: 16,
        properties: props({ id: 'p2', minor: 'armor_plate' }),
      },
    ];
    expect(parseChunkObjects(chunk, raw).pickups).toEqual([
      { key: 'test_x01_y02:p1', ability: 'mortar', x: ox + 16, y: oy + 16 },
      { key: 'test_x01_y02:p2', minor: 'armor_plate', x: ox + 72, y: oy + 40 },
    ]);
  });

  it('parses depots as pads (a point gets the default 32px pad)', () => {
    const raw: RawObject[] = [
      { id: 1, type: 'depot', x: 100, y: 100, properties: props({ id: 'd1' }) },
      {
        id: 2,
        type: 'depot',
        x: 0,
        y: 0,
        width: 48,
        height: 32,
        properties: props({ id: 'd2' }),
      },
    ];
    expect(parseChunkObjects(chunk, raw).depots).toEqual([
      { key: 'test_x01_y02:d1', x: ox + 100, y: oy + 100, width: 32, height: 32 },
      { key: 'test_x01_y02:d2', x: ox + 24, y: oy + 16, width: 48, height: 32 },
    ]);
  });

  it('parses switches, and doors linked to their switch by full key', () => {
    const raw: RawObject[] = [
      {
        id: 1,
        type: 'switch',
        x: 40,
        y: 40,
        properties: props({ id: 's1', activatedBy: 'mortar' }),
      },
      {
        id: 2,
        type: 'door',
        x: 96,
        y: 0,
        width: 16,
        height: 48,
        properties: props({ id: 'door1', opensWith: 's1' }),
      },
    ];
    const parsed = parseChunkObjects(chunk, raw);
    expect(parsed.switches).toEqual([
      { key: 'test_x01_y02:s1', activatedBy: 'mortar', x: ox + 40, y: oy + 40 },
    ]);
    expect(parsed.doors).toEqual([
      {
        key: 'test_x01_y02:door1',
        opensWith: 'test_x01_y02:s1',
        x: ox + 104,
        y: oy + 24,
        width: 16,
        height: 48,
      },
    ]);
  });

  it('parses boulders', () => {
    const raw: RawObject[] = [
      { id: 9, type: 'boulder', x: 8, y: 8, properties: props({ id: 'b1' }) },
    ];
    expect(parseChunkObjects(chunk, raw).boulders).toEqual([
      { key: 'test_x01_y02:b1', x: ox + 8, y: oy + 8 },
    ]);
  });
});

describe('findDepot', () => {
  const chunks = [
    { id: 'test_x00_y00', cx: 0, cy: 0 },
    { id: 'test_x01_y02', cx: 1, cy: 2 },
  ];
  const objectsOf = (id: string): RawObject[] =>
    id === 'test_x01_y02'
      ? [{ id: 1, type: 'depot', x: 100, y: 100, properties: props({ id: 'd1' }) }]
      : [];

  it('finds a depot by its <chunkId>:<id> key', () => {
    expect(findDepot(chunks, objectsOf, 'test_x01_y02:d1')).toMatchObject({
      x: ox + 100,
      y: oy + 100,
    });
  });

  it('returns null for a missing chunk or depot', () => {
    expect(findDepot(chunks, objectsOf, 'test_x01_y02:nope')).toBeNull();
    expect(findDepot(chunks, objectsOf, 'test_x09_y09:d1')).toBeNull();
  });
});

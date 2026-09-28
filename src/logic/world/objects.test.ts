import { describe, expect, it } from 'vitest';
import { CHUNK_PX_H, CHUNK_PX_W } from './chunks';
import { parseChunkObjects, type RawObject } from './objects';

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
    expect(parseChunkObjects(chunk, raw)).toEqual({
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
      enemies: [],
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
});

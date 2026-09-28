import { CHUNK_PX_H, CHUNK_PX_W, type ChunkCoord } from './chunks';

/**
 * Turns a chunk's `objects` layer into spawn specs in world pixels (docs/LEVEL_DESIGN.md, Object
 * types). Ids are validated by `validate:maps`, so values are taken as they come here.
 */

export interface RawObject {
  id: number;
  name?: string;
  type?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  polyline?: { x: number; y: number }[];
  properties?: { name: string; value: unknown }[];
}

export interface DestructibleSpec {
  /** Persistent key, `<chunkId>:<id>`. */
  key: string;
  material: string;
  /** Centre, world px. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EnemySpec {
  /** `<chunkId>:<object id>`; enemies respawn, so this only tells spawned instances apart. */
  key: string;
  enemyType: string;
  level: number;
  x: number;
  y: number;
  /** Waypoints, world px, from the polyline named by the `patrol` property. */
  patrol?: { x: number; y: number }[];
}

export interface ChunkObjects {
  destructibles: DestructibleSpec[];
  enemies: EnemySpec[];
}

const propsOf = (o: RawObject) =>
  Object.fromEntries((o.properties ?? []).map((p) => [p.name, p.value])) as Record<string, unknown>;

export function parseChunkObjects(
  chunk: ChunkCoord & { id: string },
  objects: readonly RawObject[],
): ChunkObjects {
  const ox = chunk.cx * CHUNK_PX_W;
  const oy = chunk.cy * CHUNK_PX_H;
  const result: ChunkObjects = { destructibles: [], enemies: [] };

  for (const o of objects) {
    const props = propsOf(o);
    if (o.type === 'destructible') {
      const width = o.width ?? 0;
      const height = o.height ?? 0;
      result.destructibles.push({
        key: `${chunk.id}:${String(props.id)}`,
        material: String(props.material),
        x: ox + o.x + width / 2,
        y: oy + o.y + height / 2,
        width,
        height,
      });
    } else if (o.type === 'enemy') {
      const line = objects.find((p) => p.polyline && p.name === props.patrol);
      const spec: EnemySpec = {
        key: `${chunk.id}:${o.id}`,
        enemyType: String(props.enemyType),
        level: Number(props.level ?? 0),
        x: ox + o.x,
        y: oy + o.y,
      };
      if (line?.polyline)
        spec.patrol = line.polyline.map((p) => ({ x: ox + line.x + p.x, y: oy + line.y + p.y }));
      result.enemies.push(spec);
    }
  }
  return result;
}

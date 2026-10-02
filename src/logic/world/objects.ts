import type { AbilityId, MinorPickupId } from '../../data/abilities';
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
  /** Degrees clockwise. */
  rotation?: number;
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
  /** Radians, 0 = east (Tiled rotation); static guns face this way. */
  facing: number;
  /** Waypoints, world px, from the polyline named by the `patrol` property. */
  patrol?: { x: number; y: number }[];
}

export interface PickupSpec {
  /** `<chunkId>:<id>` */
  key: string;
  ability?: AbilityId;
  minor?: MinorPickupId;
  x: number;
  y: number;
}

/** A rect in world px, by its centre. */
export interface RectSpec {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SwitchSpec {
  key: string;
  activatedBy: string;
  x: number;
  y: number;
}

export interface DoorSpec extends RectSpec {
  /** Key of the switch that opens it, `<chunkId>:<switch id>`. */
  opensWith: string;
}

export interface BoulderSpec {
  key: string;
  x: number;
  y: number;
}

export interface ChunkObjects {
  destructibles: DestructibleSpec[];
  enemies: EnemySpec[];
  pickups: PickupSpec[];
  depots: RectSpec[];
  switches: SwitchSpec[];
  doors: DoorSpec[];
  boulders: BoulderSpec[];
}

/** A depot placed as a point gets a pad this size, px. */
export const DEFAULT_DEPOT_SIZE = 32;

const propsOf = (o: RawObject) =>
  Object.fromEntries((o.properties ?? []).map((p) => [p.name, p.value])) as Record<string, unknown>;

export function parseChunkObjects(
  chunk: ChunkCoord & { id: string },
  objects: readonly RawObject[],
): ChunkObjects {
  const ox = chunk.cx * CHUNK_PX_W;
  const oy = chunk.cy * CHUNK_PX_H;
  const result: ChunkObjects = {
    destructibles: [],
    enemies: [],
    pickups: [],
    depots: [],
    switches: [],
    doors: [],
    boulders: [],
  };
  /** Centre of a rect object, or the point itself. */
  const centre = (o: RawObject) => ({
    x: ox + o.x + (o.width ?? 0) / 2,
    y: oy + o.y + (o.height ?? 0) / 2,
  });

  for (const o of objects) {
    const props = propsOf(o);
    const key = `${chunk.id}:${String(props.id)}`;
    if (o.type === 'pickup') {
      const spec: PickupSpec = { key, ...centre(o) };
      if (props.ability !== undefined) spec.ability = props.ability as AbilityId;
      if (props.minor !== undefined) spec.minor = props.minor as MinorPickupId;
      result.pickups.push(spec);
    } else if (o.type === 'depot') {
      result.depots.push({
        key,
        ...centre(o),
        width: o.width || DEFAULT_DEPOT_SIZE,
        height: o.height || DEFAULT_DEPOT_SIZE,
      });
    } else if (o.type === 'switch') {
      result.switches.push({ key, activatedBy: String(props.activatedBy), ...centre(o) });
    } else if (o.type === 'door') {
      result.doors.push({
        key,
        opensWith: `${chunk.id}:${String(props.opensWith)}`,
        ...centre(o),
        width: o.width ?? 0,
        height: o.height ?? 0,
      });
    } else if (o.type === 'boulder') {
      result.boulders.push({ key, ...centre(o) });
    } else if (o.type === 'destructible') {
      const width = o.width ?? 0;
      const height = o.height ?? 0;
      result.destructibles.push({
        key,
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
        facing: ((o.rotation ?? 0) * Math.PI) / 180,
      };
      if (line?.polyline)
        spec.patrol = line.polyline.map((p) => ({ x: ox + line.x + p.x, y: oy + line.y + p.y }));
      result.enemies.push(spec);
    }
  }
  return result;
}

/** The depot with save key `<chunkId>:<id>`, from that chunk's objects; null if it's gone. */
export function findDepot(
  chunks: readonly (ChunkCoord & { id: string })[],
  objectsOf: (chunkId: string) => readonly RawObject[],
  key: string,
): RectSpec | null {
  const chunk = chunks.find((c) => key.startsWith(`${c.id}:`));
  if (!chunk) return null;
  return parseChunkObjects(chunk, objectsOf(chunk.id)).depots.find((d) => d.key === key) ?? null;
}

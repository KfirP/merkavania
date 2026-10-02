import { abilityIds, minorPickupIds } from '../../data/abilities';
import { isEnemyId } from '../../data/enemies';
import { isMaterialId } from '../../data/materials';
import { allMkTierIds } from '../../data/mkTiers';
import { isTerrainId } from '../../data/terrain';
import { CHUNK_H, CHUNK_W, chunkId } from './chunks';
import { parseChunkGrid, type ChunkGrid, type Dir, type GridMap } from './grid';
import type { RawObject as ReachObject } from './objects';
import { checkReachability } from './reachability';
import { embedTilesets, resolveRelativePath, type TiledMap, type TiledTileset } from './tiled';
import { levelsConnect } from './traversal';
import { parseWorld, type TiledWorld, type WorldChunk } from './world';

/**
 * Map validation rules (docs/LEVEL_DESIGN.md, "What validate:maps checks", rules 1–6; rule 6,
 * reachability, lives in reachability.ts). Pure: files come in through `load(path)` with
 * public/-relative paths. Boss ids are only checked for presence until their table exists (M7).
 */

export interface MapIssue {
  file: string;
  layer?: string;
  /** `#<object id>` */
  object?: string;
  message: string;
}

export interface KnownIds {
  /** Asset-manifest image key → public/-relative path. */
  imageAssets: ReadonlyMap<string, string>;
  /** i18n keys (en.json). */
  messageKeys: ReadonlySet<string>;
}

export type Load = (path: string) => unknown;

export function formatIssue({ file, layer, object, message }: MapIssue): string {
  const where = [file, layer, object].filter((s) => s !== undefined).join(':');
  return `${where} ${message}`;
}

// --- Tilesets ---

interface Property {
  name: string;
  value: unknown;
}

interface RawTileset {
  name?: string;
  image?: string;
  tilecount?: number;
  tiles?: { id: number; properties?: Property[] }[];
}

const RAMP_DIRS = ['n', 's', 'e', 'w'];

function tilePropertyIssue({ name, value }: Property): string | null {
  switch (name) {
    case 'terrain':
      return typeof value === 'string' && isTerrainId(value)
        ? null
        : `unknown terrain ${JSON.stringify(value)}`;
    case 'level':
      return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 3
        ? null
        : `level must be an integer 0–3, got ${JSON.stringify(value)}`;
    case 'ramp':
      return RAMP_DIRS.includes(value as string)
        ? null
        : `ramp must be n, s, e or w, got ${JSON.stringify(value)}`;
    case 'steep':
    case 'solid':
      return typeof value === 'boolean' ? null : `${name} must be a boolean`;
    default:
      return null;
  }
}

/** A `.tsj`: its name is a manifest image with the same file, and its tile properties are known. */
export function validateTileset(path: string, data: unknown, known: KnownIds): MapIssue[] {
  const ts = data as RawTileset;
  const issues: MapIssue[] = [];
  const issue = (message: string) => issues.push({ file: path, message });

  const manifestPath = known.imageAssets.get(ts.name ?? '');
  if (manifestPath === undefined)
    issue(`name "${ts.name}" is not an image key in the asset manifest`);
  else if (ts.image !== undefined) {
    const image = resolveRelativePath(path, ts.image);
    if (image !== manifestPath)
      issue(`image ${image} does not match the manifest path ${manifestPath} for ${ts.name}`);
  }
  for (const tile of ts.tiles ?? [])
    for (const p of tile.properties ?? []) {
      const problem = tilePropertyIssue(p);
      if (problem) issue(`tile ${tile.id}: ${problem}`);
    }
  return issues;
}

// --- Maps ---

const LAYERS = ['ground', 'elevation', 'walls', 'decor', 'above', 'objects'];
const GID_MASK = 0x1fffffff;

interface RawObject {
  id: number;
  name?: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  polyline?: unknown[];
  properties?: Property[];
}

interface RawLayer {
  name: string;
  type?: string;
  visible?: boolean;
  data?: number[];
  objects?: RawObject[];
}

interface RawMap {
  width: number;
  height: number;
  layers: RawLayer[];
  tilesets: { firstgid: number; source?: string; name?: string }[];
}

const oneOf = (name: string, values: readonly string[]) => (v: unknown) =>
  values.includes(v as string)
    ? null
    : `${name} must be one of ${values.join(', ')}, got ${JSON.stringify(v)}`;

const ACTIVATED_BY = ['cannon', 'mortar', 'scout', 'drone', 'lahat', 'remote'];
const ZONE_KINDS = ['sensor', 'boss_arena', 'radio_trigger'];

interface ObjectRule {
  required: string[];
  checks?: Record<string, (value: unknown, known: KnownIds) => string | null>;
}

/** Object types and properties (LEVEL_DESIGN.md, Object types). */
const OBJECT_RULES: Record<string, ObjectRule> = {
  spawn: { required: [] },
  exit: { required: ['toBiome', 'toChunk', 'toSpawn'] },
  depot: { required: ['id'] },
  pickup: {
    required: ['id'],
    checks: {
      ability: (v) =>
        abilityIds.includes(v as never) ? null : `unknown ability ${JSON.stringify(v)}`,
      minor: (v) =>
        minorPickupIds.includes(v as never) ? null : `unknown minor pickup ${JSON.stringify(v)}`,
    },
  },
  mk_upgrade: {
    required: ['tier'],
    checks: {
      tier: (v) => (allMkTierIds.includes(v as never) ? null : `unknown tier ${JSON.stringify(v)}`),
    },
  },
  enemy: {
    required: ['enemyType', 'level'],
    checks: {
      enemyType: (v) => (isEnemyId(v) ? null : `unknown enemy type ${JSON.stringify(v)}`),
      level: (value) => tilePropertyIssue({ name: 'level', value }),
    },
  },
  boss: { required: ['bossType', 'arena'] },
  destructible: {
    required: ['material', 'id'],
    checks: {
      material: (v) => (isMaterialId(v) ? null : `unknown material ${JSON.stringify(v)}`),
    },
  },
  boulder: { required: ['id'] },
  switch: {
    required: ['id', 'activatedBy'],
    checks: { activatedBy: oneOf('activatedBy', ACTIVATED_BY) },
  },
  door: { required: ['id', 'opensWith'] },
  zone: { required: ['kind'], checks: { kind: oneOf('kind', ZONE_KINDS) } },
  radio: {
    required: ['messageKey'],
    checks: {
      messageKey: (v, known) =>
        known.messageKeys.has(v as string) ? null : `unknown message key ${JSON.stringify(v)}`,
    },
  },
};

const PERSISTENT_TYPES = new Set(['depot', 'pickup', 'destructible', 'boulder', 'switch', 'door']);

const propsOf = (o: RawObject) =>
  Object.fromEntries((o.properties ?? []).map((p) => [p.name, p.value])) as Record<string, unknown>;

function validateObjects(file: string, objects: RawObject[], known: KnownIds): MapIssue[] {
  const issues: MapIssue[] = [];
  const at = (o: RawObject, message: string) =>
    issues.push({ file, layer: 'objects', object: `#${o.id}`, message });

  for (const o of objects) {
    // Untyped polylines are patrol paths, referenced by name from enemies.
    if (o.polyline && !o.type) continue;
    const rule = OBJECT_RULES[o.type ?? ''];
    if (!rule) {
      at(o, `unknown object type ${JSON.stringify(o.type ?? '')}`);
      continue;
    }
    const props = propsOf(o);
    if (o.type === 'spawn' && !o.name) at(o, 'spawn needs a name');
    if (o.type === 'door' && !(o.width && o.height))
      at(o, 'door must be a rectangle (it blocks the cells it covers)');
    if (o.type === 'pickup' && props.ability === undefined && props.minor === undefined)
      at(o, 'pickup needs an ability or minor property');
    for (const [name, check] of Object.entries(rule.checks ?? {}))
      if (props[name] !== undefined) {
        const problem = check(props[name], known);
        if (problem) at(o, problem);
      }
    for (const name of rule.required)
      if (props[name] === undefined || props[name] === '') at(o, `missing property "${name}"`);
  }

  const seen = new Set<string>();
  for (const o of objects) {
    if (!PERSISTENT_TYPES.has(o.type ?? '')) continue;
    const id = propsOf(o).id;
    if (id === undefined) continue;
    if (seen.has(String(id))) at(o, `duplicate id "${id}"`);
    seen.add(String(id));
  }

  const polylines = new Set(objects.filter((o) => o.polyline).map((o) => o.name));
  for (const o of objects) {
    const patrol = propsOf(o).patrol;
    if (o.type === 'enemy' && patrol !== undefined && !polylines.has(String(patrol)))
      at(o, `patrol "${patrol}" is not a polyline here`);
  }

  const switches = new Set(
    objects.filter((o) => o.type === 'switch').map((o) => String(propsOf(o).id)),
  );
  for (const o of objects) {
    const target = propsOf(o).opensWith;
    if (o.type === 'door' && target !== undefined && !switches.has(String(target)))
      at(o, `opensWith "${target}" is not a switch here`);
  }
  return issues;
}

function validateMap(
  path: string,
  map: RawMap,
  load: Load,
  known: KnownIds,
  isChunk: boolean,
): MapIssue[] {
  const issues: MapIssue[] = [];
  const issue = (message: string, layer?: string) => issues.push({ file: path, layer, message });

  if (isChunk && (map.width !== CHUNK_W || map.height !== CHUNK_H))
    issue(`chunk is ${map.width}×${map.height}, expected ${CHUNK_W}×${CHUNK_H}`);
  if (map.layers.map((l) => l.name).join() !== LAYERS.join())
    issue(`layers must be ${LAYERS.join(', ')}`);
  if (map.layers.find((l) => l.name === 'elevation')?.visible !== false)
    issue('must be hidden', 'elevation');

  const ranges: [number, number][] = [];
  for (const ts of map.tilesets) {
    if (ts.source === undefined) {
      issue(`tileset "${ts.name}" must be an external .tsj`);
      continue;
    }
    const data = load(resolveRelativePath(path, ts.source)) as RawTileset | undefined;
    if (!data) issue(`tileset ${ts.source} not found`);
    else ranges.push([ts.firstgid, ts.firstgid + (data.tilecount ?? 0)]);
  }
  const knownGid = (gid: number) => ranges.some(([lo, hi]) => gid >= lo && gid < hi);
  for (const layer of map.layers) {
    const i = (layer.data ?? []).findIndex((g) => g !== 0 && !knownGid(g & GID_MASK));
    if (i >= 0) {
      const gid = layer.data![i]! & GID_MASK;
      issue(
        `unknown tile gid ${gid} at (${i % map.width}, ${Math.floor(i / map.width)})`,
        layer.name,
      );
    }
  }

  const objects = map.layers.find((l) => l.name === 'objects')?.objects ?? [];
  issues.push(...validateObjects(path, objects, known));
  return issues;
}

/** A map outside any `.world` (e.g. a sandbox): every rule except the chunk size and edges. */
export function validateStandaloneMap(
  path: string,
  map: unknown,
  load: Load,
  known: KnownIds,
): MapIssue[] {
  return validateMap(path, map as RawMap, load, known, false);
}

// --- Worlds ---

interface LoadedChunk {
  chunk: WorldChunk;
  map: RawMap;
  grid: ChunkGrid | null;
}

const OFFSETS: [Dir, number, number][] = [
  ['e', 1, 0],
  ['s', 0, 1],
];

/** Neighbouring chunks must agree on elevation where they meet (a wall on either side is fine). */
function validateEdges(chunks: Map<string, LoadedChunk>): MapIssue[] {
  const issues: MapIssue[] = [];
  const byCoord = new Map([...chunks.values()].map((c) => [`${c.chunk.cx},${c.chunk.cy}`, c]));
  for (const a of chunks.values())
    for (const [dir, dx, dy] of OFFSETS) {
      const b = byCoord.get(`${a.chunk.cx + dx},${a.chunk.cy + dy}`);
      if (!a.grid || !b?.grid) continue;
      const count = dir === 'e' ? CHUNK_H : CHUNK_W;
      for (let k = 0; k < count; k++) {
        const [ax, ay, bx, by] = dir === 'e' ? [CHUNK_W - 1, k, 0, k] : [k, CHUNK_H - 1, k, 0];
        const ca = a.grid.cells[ay * CHUNK_W + ax]!;
        const cb = b.grid.cells[by * CHUNK_W + bx]!;
        if (ca.solid || cb.solid || levelsConnect(ca, cb, dir)) continue;
        issues.push({
          file: b.chunk.path,
          layer: 'elevation',
          message: `level ${cb.level} at (${bx}, ${by}) does not match level ${ca.level} across the edge with ${a.chunk.id}`,
        });
        break;
      }
    }
  return issues;
}

function gridOf(path: string, map: RawMap, load: Load): ChunkGrid | null {
  try {
    const embedded = embedTilesets(
      map as unknown as TiledMap,
      (source) => load(resolveRelativePath(path, source)) as TiledTileset | undefined,
    );
    return parseChunkGrid(embedded as unknown as GridMap);
  } catch {
    return null; // an unresolved tileset, already reported
  }
}

/** Exits must name a biome, chunk and spawn that exist. */
function validateExits(biomes: Map<string, Map<string, LoadedChunk>>): MapIssue[] {
  const issues: MapIssue[] = [];
  for (const chunks of biomes.values())
    for (const { chunk, map } of chunks.values()) {
      const objects = map.layers.find((l) => l.name === 'objects')?.objects ?? [];
      for (const o of objects.filter((obj) => obj.type === 'exit')) {
        const { toBiome, toChunk, toSpawn } = propsOf(o);
        const at = (message: string) =>
          issues.push({ file: chunk.path, layer: 'objects', object: `#${o.id}`, message });
        const target = biomes.get(String(toBiome));
        if (!target) {
          at(`exit to unknown biome "${toBiome}"`);
          continue;
        }
        const dest = target.get(String(toChunk));
        if (!dest) {
          at(`exit to unknown chunk "${toChunk}"`);
          continue;
        }
        const spawns = dest.map.layers.find((l) => l.name === 'objects')?.objects ?? [];
        if (!spawns.some((s) => s.type === 'spawn' && s.name === toSpawn))
          at(`exit to unknown spawn "${toSpawn}" in ${toChunk}`);
      }
    }
  return issues;
}

/** Every `.world` and its chunks: rules 1–5, plus exits across all the worlds given. */
export function validateWorlds(worldPaths: string[], load: Load, known: KnownIds): MapIssue[] {
  const issues: MapIssue[] = [];
  const biomes = new Map<string, Map<string, LoadedChunk>>();

  for (const worldPath of worldPaths) {
    let world;
    try {
      world = parseWorld(load(worldPath) as TiledWorld, worldPath);
    } catch (err) {
      issues.push({ file: worldPath, message: (err as Error).message });
      continue;
    }
    const chunks = new Map<string, LoadedChunk>();
    biomes.set(world.biome, chunks);
    for (const chunk of world.chunks) {
      const expected = chunkId(world.biome, chunk);
      if (chunk.id !== expected)
        issues.push({
          file: worldPath,
          message: `chunk at (${chunk.cx}, ${chunk.cy}) must be named ${expected}`,
        });
      const map = load(chunk.path) as RawMap | undefined;
      if (!map) {
        issues.push({ file: chunk.path, message: 'missing chunk file' });
        continue;
      }
      issues.push(...validateMap(chunk.path, map, load, known, true));
      chunks.set(chunk.id, { chunk, map, grid: gridOf(chunk.path, map, load) });
    }
    issues.push(...validateEdges(chunks));
    issues.push(
      ...checkReachability(
        [...chunks.values()].flatMap(({ chunk, map, grid }) =>
          grid
            ? [
                {
                  chunk,
                  grid,
                  objects: (map.layers.find((l) => l.name === 'objects')?.objects ??
                    []) as ReachObject[],
                },
              ]
            : [],
        ),
      ),
    );
  }
  issues.push(...validateExits(biomes));
  return issues;
}

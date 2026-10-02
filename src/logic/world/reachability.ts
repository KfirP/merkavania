import { abilityIds, type AbilityId } from '../../data/abilities';
import { mkSignatures } from '../../data/mkTiers';
import { weapons } from '../../data/weapons';
import { CHUNK_PX_H, CHUNK_PX_W, TILE, type ChunkCoord } from './chunks';
import type { Cell, ChunkGrid, Dir } from './grid';
import { hasLineOfSight } from './lineOfSight';
import type { RawObject } from './objects';
import { canEnter, type MoveContext } from './traversal';
import type { MapIssue } from './validate';

/**
 * Progression reachability (docs/LEVEL_DESIGN.md, validate:maps rule 6). Starting at `start` as a
 * Mk2 with no abilities, it floods the cells the tank can drive to, takes every pickup and
 * `mk_upgrade` it reaches, flips every switch it can activate from there (which opens their doors),
 * and repeats until nothing changes. Every pickup, depot, boss and `mk_upgrade` still unreached is
 * reported. It works on single cells, so it's coarse: it doesn't know the tank is 2 tiles wide.
 */

export interface ReachChunk {
  chunk: ChunkCoord & { id: string; path: string };
  grid: ChunkGrid;
  objects: readonly RawObject[];
}

interface Placed {
  file: string;
  raw: RawObject;
  props: Record<string, unknown>;
  /** Centre, world px. */
  x: number;
  y: number;
  tile: string;
}

const STEPS: [Dir, number, number][] = [
  ['n', 0, -1],
  ['s', 0, 1],
  ['e', 1, 0],
  ['w', -1, 0],
];

/** Object types that must be reachable, and how a report names them. */
const MUST_REACH = ['pickup', 'depot', 'boss', 'mk_upgrade'];

const tileKey = (tx: number, ty: number) => `${tx},${ty}`;
const tileOf = (x: number, y: number) => tileKey(Math.floor(x / TILE), Math.floor(y / TILE));
const centreOfTile = (key: string) => {
  const [tx, ty] = key.split(',').map(Number) as [number, number];
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
};

export function checkReachability(chunks: readonly ReachChunk[]): MapIssue[] {
  const cells = new Map<string, Cell>();
  const placed: Placed[] = [];
  for (const { chunk, grid, objects } of chunks) {
    grid.cells.forEach((cell, i) => {
      const tx = chunk.cx * grid.width + (i % grid.width);
      const ty = chunk.cy * grid.height + Math.floor(i / grid.width);
      cells.set(tileKey(tx, ty), cell);
    });
    const ox = chunk.cx * CHUNK_PX_W;
    const oy = chunk.cy * CHUNK_PX_H;
    for (const raw of objects) {
      const props = Object.fromEntries((raw.properties ?? []).map((p) => [p.name, p.value]));
      // A rect's centre, or the point itself (doors keep their whole rect, below).
      const x = ox + raw.x + (raw.width ?? 0) / 2;
      const y = oy + raw.y + (raw.height ?? 0) / 2;
      placed.push({
        file: chunk.path,
        raw: { ...raw, x: ox + raw.x, y: oy + raw.y },
        props,
        x,
        y,
        tile: tileOf(x, y),
      });
    }
  }

  const start = placed.find((o) => o.raw.type === 'spawn' && o.raw.name === 'start');
  // Other biomes are entered through exits; only the world with `start` is checked for now.
  if (!start) return [];

  // Switch and door keys are `<file>:<id>`: ids are only unique per chunk.
  const keyOf = (o: Placed, id: unknown) => `${o.file}:${String(id)}`;
  const switches = placed.filter((o) => o.raw.type === 'switch');
  const doors = placed
    .filter((o) => o.raw.type === 'door')
    .map((o) => {
      const tiles = new Set<string>();
      const { x, y, width = 0, height = 0 } = o.raw;
      for (let tx = Math.floor(x / TILE); tx < Math.ceil((x + width) / TILE); tx++)
        for (let ty = Math.floor(y / TILE); ty < Math.ceil((y + height) / TILE); ty++)
          tiles.add(tileKey(tx, ty));
      return { opensWith: keyOf(o, o.props.opensWith), tiles };
    });

  const on = new Set<string>();
  const closedDoorTiles = () => {
    const tiles = new Set<string>();
    for (const d of doors) if (!on.has(d.opensWith)) for (const t of d.tiles) tiles.add(t);
    return tiles;
  };
  let blocked = closedDoorTiles();
  const cellAt = (tx: number, ty: number): Cell | null => {
    const cell = cells.get(tileKey(tx, ty)) ?? null;
    return cell && blocked.has(tileKey(tx, ty)) ? { ...cell, solid: true } : cell;
  };

  const flood = (seeds: Iterable<string>, ctx: MoveContext): Set<string> => {
    const seen = new Set(seeds);
    const queue = [...seen];
    while (queue.length) {
      const [x, y] = queue.pop()!.split(',').map(Number) as [number, number];
      const from = cellAt(x, y);
      for (const [dir, dx, dy] of STEPS) {
        const next = tileKey(x + dx, y + dy);
        if (seen.has(next) || !canEnter(from, cellAt(x + dx, y + dy), dir, ctx)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    return seen;
  };

  const abilities = new Set<AbilityId>();
  const taken = new Set<Placed>();
  let reached = new Set<string>();

  const canActivate = (sw: Placed): boolean => {
    const level = cells.get(sw.tile)?.level ?? 0;
    switch (sw.props.activatedBy) {
      case 'cannon': {
        const range = weapons.gun_105.range;
        return [...reached].some((t) => {
          if (cells.get(t)?.level !== level) return false;
          const from = centreOfTile(t);
          if (Math.hypot(from.x - sw.x, from.y - sw.y) > range) return false;
          return hasLineOfSight(from, sw, level, cellAt);
        });
      }
      case 'mortar': {
        if (!abilities.has('mortar')) return false;
        const { range, lob } = weapons.mortar_60;
        return [...reached].some((t) => {
          const from = centreOfTile(t);
          const d = Math.hypot(from.x - sw.x, from.y - sw.y);
          return d >= lob!.minRange && d <= range;
        });
      }
      case 'scout':
        return (
          abilities.has('hatch_scout') &&
          flood(reached, { pawn: 'scout', abilities: [...abilities] }).has(sw.tile)
        );
      default:
        return false; // drone, lahat and remote switches can't be checked yet
    }
  };

  for (let changed = true; changed;) {
    changed = false;
    blocked = closedDoorTiles();
    reached = flood([start.tile], { pawn: 'tank', abilities: [...abilities] });
    for (const o of placed) {
      if (taken.has(o) || !reached.has(o.tile)) continue;
      const grant =
        o.raw.type === 'pickup'
          ? o.props.ability
          : o.raw.type === 'mk_upgrade'
            ? mkSignatures[o.props.tier as keyof typeof mkSignatures]
            : undefined;
      if (grant === undefined) continue;
      taken.add(o);
      if (abilityIds.includes(grant as AbilityId) && !abilities.has(grant as AbilityId)) {
        abilities.add(grant as AbilityId);
        changed = true;
      }
    }
    for (const sw of switches) {
      const key = keyOf(sw, sw.props.id);
      if (on.has(key) || !canActivate(sw)) continue;
      on.add(key);
      changed = true;
    }
  }

  const have = abilities.size ? [...abilities].sort().join(', ') : 'none';
  return placed
    .filter((o) => MUST_REACH.includes(o.raw.type ?? '') && !reached.has(o.tile))
    .map((o) => {
      const name = o.props.id ?? o.props.bossType ?? o.props.tier ?? o.raw.id;
      return {
        file: o.file,
        layer: 'objects',
        object: `#${o.raw.id}`,
        message: `${o.raw.type} "${String(name)}" is unreachable from start (abilities by then: ${have})`,
      };
    });
}

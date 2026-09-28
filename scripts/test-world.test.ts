import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assetManifest } from '../src/data/assetManifest';
import { CHUNK_H, CHUNK_W, TILE } from '../src/logic/world/chunks';
import { parseChunkGrid, type Cell, type Dir, type GridMap } from '../src/logic/world/grid';
import { embedTilesets, resolveRelativePath, type TiledMap } from '../src/logic/world/tiled';
import { canEnter, type MoveContext } from '../src/logic/world/traversal';
import { parseWorld, type TiledWorld } from '../src/logic/world/world';

/** Content checks on the M2 test world: the M1 room split into chunks plus the elevation area. */
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const WORLD_PATH = 'maps/test/test.world';

const readJson = <T>(path: string) => JSON.parse(readFileSync(PUBLIC + path, 'utf8')) as T;

interface Layer {
  name: string;
  visible?: boolean;
  objects?: { name: string; type: string; x: number; y: number }[];
}

const world = parseWorld(readJson<TiledWorld>(WORLD_PATH), WORLD_PATH);
const maps = new Map(
  world.chunks.map((c) => {
    const raw = readJson<TiledMap>(c.path);
    const map = embedTilesets(raw, (src) => readJson(resolveRelativePath(c.path, src)));
    return [c.id, { chunk: c, raw, map }] as const;
  }),
);

/** Whole-world cell lookup. */
const cells = new Map<string, Cell>();
for (const { chunk, map } of maps.values()) {
  const grid = parseChunkGrid(map as unknown as GridMap);
  grid.cells.forEach((cell, i) => {
    const tx = chunk.cx * CHUNK_W + (i % CHUNK_W);
    const ty = chunk.cy * CHUNK_H + Math.floor(i / CHUNK_W);
    cells.set(`${tx},${ty}`, cell);
  });
}
const cellAt = (tx: number, ty: number) => cells.get(`${tx},${ty}`) ?? null;

function startSpawn() {
  for (const { chunk, raw } of maps.values()) {
    const objects = (raw.layers as Layer[]).find((l) => l.name === 'objects')?.objects ?? [];
    const start = objects.find((o) => o.type === 'spawn' && o.name === 'start');
    if (start)
      return {
        x: chunk.cx * CHUNK_W * TILE + start.x,
        y: chunk.cy * CHUNK_H * TILE + start.y,
      };
  }
  return null;
}

/** Levels reachable from the start, stepping cell to cell with `canEnter`. */
function reachableLevels(ctx: MoveContext): Set<number> {
  const s = startSpawn()!;
  const origin = [Math.floor(s.x / TILE), Math.floor(s.y / TILE)] as const;
  const seen = new Set([origin.join(',')]);
  const queue = [origin];
  const levels = new Set<number>();
  const steps: [Dir, number, number][] = [
    ['n', 0, -1],
    ['s', 0, 1],
    ['e', 1, 0],
    ['w', -1, 0],
  ];
  while (queue.length) {
    const [x, y] = queue.pop()!;
    const from = cellAt(x, y)!;
    levels.add(from.level);
    for (const [dir, dx, dy] of steps) {
      const next = [x + dx, y + dy] as const;
      if (seen.has(next.join(',')) || !canEnter(from, cellAt(...next), dir, ctx)) continue;
      seen.add(next.join(','));
      queue.push(next);
    }
  }
  return levels;
}

describe('test world', () => {
  it('is in the asset manifest', () => {
    expect(assetManifest.some((a) => a.path === WORLD_PATH)).toBe(true);
  });

  it('is 4×2 chunks', () => {
    expect(world.biome).toBe('test');
    expect(world.chunks.map((c) => c.id).sort()).toEqual(
      ['x00', 'x01', 'x02', 'x03'].flatMap((x) => [`test_${x}_y00`, `test_${x}_y01`]).sort(),
    );
  });

  it('has 30×17 chunks with the LEVEL_DESIGN.md layers in order, elevation hidden', () => {
    for (const { raw } of maps.values()) {
      expect([raw.width, raw.height]).toEqual([CHUNK_W, CHUNK_H]);
      const layers = raw.layers as Layer[];
      expect(layers.map((l) => l.name)).toEqual([
        'ground',
        'elevation',
        'walls',
        'decor',
        'above',
        'objects',
      ]);
      expect(layers.find((l) => l.name === 'elevation')!.visible).toBe(false);
    }
  });

  it('uses external tilesets named after manifest images that exist', () => {
    for (const { chunk, raw } of maps.values())
      for (const ref of raw.tilesets as { source?: string }[]) {
        expect(ref.source).toBeDefined();
        const tsPath = resolveRelativePath(chunk.path, ref.source!);
        const ts = readJson<{ name: string; image: string }>(tsPath);
        const asset = assetManifest.find((a) => a.key === ts.name && a.type === 'image');
        expect(asset, ts.name).toBeDefined();
        expect(resolveRelativePath(tsPath, ts.image)).toBe(asset!.path);
        expect(existsSync(PUBLIC + asset!.path)).toBe(true);
      }
  });

  it('keeps the M1 start spawn with room for the tank', () => {
    const s = startSpawn();
    expect(s).toEqual({ x: 480, y: 408 });
    const tx = Math.floor(s!.x / TILE);
    const ty = Math.floor(s!.y / TILE);
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) expect(cellAt(tx + dx, ty + dy)!.solid).toBe(false);
  });

  it('is enclosed by solid tiles', () => {
    const w = 4 * CHUNK_W;
    const h = 2 * CHUNK_H;
    for (let x = 0; x < w; x++) {
      expect(cellAt(x, 0)!.solid).toBe(true);
      expect(cellAt(x, h - 1)!.solid).toBe(true);
    }
    for (let y = 0; y < h; y++) {
      expect(cellAt(0, y)!.solid).toBe(true);
      expect(cellAt(w - 1, y)!.solid).toBe(true);
    }
  });

  it('lets the Mk2 climb to level 1 but keeps the steep shelf for suspension', () => {
    const mk2 = reachableLevels({ pawn: 'tank', abilities: [] });
    expect([...mk2].sort()).toEqual([0, 1]);
    const mk3 = reachableLevels({ pawn: 'tank', abilities: ['suspension'] });
    expect([...mk3].sort()).toEqual([0, 1, 2]);
  });

  it('has patches of the gated and slowing terrains', () => {
    const used = new Set([...cells.values()].map((c) => c.terrain));
    for (const t of ['road', 'rock', 'water_shallow', 'water_deep', 'mud', 'rubble', 'minefield'])
      expect(used).toContain(t);
  });
});

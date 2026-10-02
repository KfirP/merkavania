import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assetManifest } from '../src/data/assetManifest';
import { CHUNK_H, CHUNK_W, TILE } from '../src/logic/world/chunks';
import { parseChunkGrid, type Cell, type Dir, type GridMap } from '../src/logic/world/grid';
import { parseChunkObjects, type RawObject } from '../src/logic/world/objects';
import { embedTilesets, resolveRelativePath, type TiledMap } from '../src/logic/world/tiled';
import { checkReachability } from '../src/logic/world/reachability';
import { canEnter, type MoveContext } from '../src/logic/world/traversal';
import { parseWorld, type TiledWorld } from '../src/logic/world/world';

/**
 * Content checks on the test world: the M1 room split into chunks, the M2 elevation area, the M3
 * combat rows and the M4 progression gallery (row y02).
 */
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

  it('is 4×3 chunks', () => {
    expect(world.biome).toBe('test');
    expect(world.chunks.map((c) => c.id).sort()).toEqual(
      ['x00', 'x01', 'x02', 'x03']
        .flatMap((x) => [`test_${x}_y00`, `test_${x}_y01`, `test_${x}_y02`])
        .sort(),
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
    const h = 3 * CHUNK_H;
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

  it('has a row of every destructible material on open level-0 ground (combat specs)', () => {
    const objects = (maps.get('test_x00_y01')!.raw.layers as Layer[]).find(
      (l) => l.name === 'objects',
    )!.objects!;
    const found = parseChunkObjects(maps.get('test_x00_y01')!.chunk, objects as RawObject[]);
    expect(found.destructibles.map((d) => d.material).sort()).toEqual(
      ['armored', 'concrete', 'sandbag', 'wood'].sort(),
    );
    for (const d of found.destructibles) {
      const cell = cellAt(Math.floor(d.x / TILE), Math.floor(d.y / TILE))!;
      expect(cell.level).toBe(0);
      expect(cell.solid).toBe(false);
    }
  });

  it('has one of each desert enemy in x03_y01, out of sight of the start and the M2 specs', () => {
    const { chunk, raw } = maps.get('test_x03_y01')!;
    const objects = (raw.layers as Layer[]).find((l) => l.name === 'objects')!.objects!;
    const { enemies } = parseChunkObjects(chunk, objects as RawObject[]);
    expect(enemies.map((e) => e.enemyType).sort()).toEqual(
      ['atgm_team', 'bunker_mg', 'light_tank', 'rifle_squad', 'technical'].sort(),
    );
    expect(enemies.find((e) => e.enemyType === 'technical')!.patrol!.length).toBeGreaterThan(2);
    for (const e of enemies) {
      const cell = cellAt(Math.floor(e.x / TILE), Math.floor(e.y / TILE))!;
      expect(cell.solid).toBe(false);
      expect(cell.level).toBe(e.level);
      // Rows 27+ keep them away from the plateau and road the world specs drive on.
      expect(e.y).toBeGreaterThanOrEqual(27 * TILE);
    }
  });

  const objectsOf = (id: string) =>
    ((maps.get(id)!.raw.layers as Layer[]).find((l) => l.name === 'objects')!.objects ??
      []) as unknown as RawObject[];
  const parsed = (id: string) => parseChunkObjects(maps.get(id)!.chunk, objectsOf(id));
  const cellUnder = (p: { x: number; y: number }) =>
    cellAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE))!;
  /** Reachability over the whole world, without the objects `drop` picks. */
  const reach = (drop: (o: RawObject) => boolean = () => false) =>
    checkReachability(
      [...maps.values()].map(({ chunk, map }) => ({
        chunk,
        grid: parseChunkGrid(map as unknown as GridMap),
        objects: objectsOf(chunk.id).filter((o) => !drop(o)),
      })),
    );
  const grants = (ability: string) => (o: RawObject) =>
    (o.properties ?? []).some((p) => p.name === 'ability' && p.value === ability);

  describe('M4 gallery (row y02)', () => {
    it('is entered from x00_y01 through a gap in its bottom wall', () => {
      const tank: MoveContext = { pawn: 'tank', abilities: [] };
      for (const tx of [3, 4, 5, 6]) {
        const from = cellAt(tx, 2 * CHUNK_H - 1);
        expect(canEnter(from, cellAt(tx, 2 * CHUNK_H), 's', tank)).toBe(true);
      }
    });

    it('has a depot and the slice pickups on open level-0 ground in x00_y02', () => {
      const { depots, pickups, boulders } = parsed('test_x00_y02');
      expect(depots).toHaveLength(1);
      expect(pickups.map((p) => p.ability ?? p.minor).sort()).toEqual(
        ['ammo_rack', 'armor_plate', 'dozer_blade', 'mortar'].sort(),
      );
      expect(boulders).toHaveLength(1);
      for (const o of [...depots, ...pickups, ...boulders]) {
        expect(cellUnder(o).solid).toBe(false);
        expect(cellUnder(o).level).toBe(0);
      }
    });

    it('guards the way east with rubble', () => {
      const without: MoveContext = { pawn: 'tank', abilities: [] };
      const withDozer: MoveContext = { pawn: 'tank', abilities: ['dozer_blade'] };
      const rubble = [...cells.entries()].filter(([, c]) => c.terrain === 'rubble');
      const inGallery = rubble.filter(([k]) => Number(k.split(',')[1]) >= 2 * CHUNK_H);
      expect(inGallery.length).toBeGreaterThan(0);
      const [x, y] = inGallery[0]![0].split(',').map(Number) as [number, number];
      expect(canEnter(cellAt(x - 1, y), cellAt(x, y), 'e', without)).toBe(false);
      expect(canEnter(cellAt(x - 1, y), cellAt(x, y), 'e', withDozer)).toBe(true);
    });

    it('puts a mortar switch on a level-1 shelf behind a door it opens', () => {
      const { switches, doors } = parsed('test_x01_y02');
      expect(switches).toEqual([expect.objectContaining({ activatedBy: 'mortar' })]);
      expect(cellUnder(switches[0]!).level).toBe(1);
      expect(doors).toEqual([expect.objectContaining({ opensWith: switches[0]!.key })]);
    });

    it('puts a cannon switch on level 0 and the door it opens in x02_y02', () => {
      const { switches, doors } = parsed('test_x02_y02');
      expect(switches).toEqual([expect.objectContaining({ activatedBy: 'cannon' })]);
      expect(cellUnder(switches[0]!).level).toBe(0);
      expect(doors).toEqual([expect.objectContaining({ opensWith: switches[0]!.key })]);
    });

    it('is fully reachable, and the far end (with the M5 corner) needs the mortar', () => {
      expect(reach()).toEqual([]);
      const noMortar = reach(grants('mortar'));
      expect(noMortar.map((i) => i.message).sort()).toEqual(
        ['ammo_rack_2', 'armor_plate_2', 'hatch_scout', 'repair_kit_1'].map((id) =>
          expect.stringMatching(new RegExp(`pickup "${id}" is unreachable`)),
        ),
      );
    });
  });

  describe('M5 corner (x03_y02)', () => {
    const found = parsed('test_x03_y02');
    const scout: MoveContext = { pawn: 'scout', abilities: [] };
    const tank: MoveContext = { pawn: 'tank', abilities: [] };
    const crawl = [...cells.entries()]
      .filter(([, c]) => c.terrain === 'crawlspace')
      .map(([k]) => k.split(',').map(Number) as [number, number]);

    it('has the hatch scout pickup on open level-0 ground', () => {
      const hatch = found.pickups.find((p) => p.ability === 'hatch_scout')!;
      expect(hatch).toBeDefined();
      expect(cellUnder(hatch).solid).toBe(false);
      expect(cellUnder(hatch).level).toBe(0);
    });

    it('has crawlspace the scout can walk into and the tank cannot', () => {
      expect(crawl.length).toBeGreaterThan(0);
      for (const [x, y] of crawl) {
        const cell = cellAt(x, y)!;
        expect(cell.solid).toBe(false);
        const from = [cellAt(x - 1, y), cellAt(x + 1, y)].find((c) => c && !c.solid)!;
        expect(canEnter(from, cell, 'e', scout)).toBe(true);
        expect(canEnter(from, cell, 'e', tank)).toBe(false);
      }
    });

    it('puts a scout switch behind the crawlspace, with the door it opens', () => {
      expect(found.switches).toEqual([expect.objectContaining({ activatedBy: 'scout' })]);
      expect(found.doors).toEqual([expect.objectContaining({ opensWith: found.switches[0]!.key })]);
      // The door is wide enough for the tank (corridors are at least 3 tiles).
      expect(found.doors[0]!.width).toBeGreaterThanOrEqual(3 * TILE);
    });

    it('keeps the pocket and closet pickups behind the hatch', () => {
      expect(reach()).toEqual([]);
      expect(
        reach(grants('hatch_scout'))
          .map((i) => i.message)
          .sort(),
      ).toEqual([
        expect.stringMatching(/pickup "ammo_rack_2" is unreachable/),
        expect.stringMatching(/pickup "armor_plate_2" is unreachable/),
      ]);
    });
  });
});

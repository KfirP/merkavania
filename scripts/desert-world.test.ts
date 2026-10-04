import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assetManifest } from '../src/data/assetManifest';
import { enemyIds } from '../src/data/enemies';
import { CHUNK_H, CHUNK_W, TILE } from '../src/logic/world/chunks';
import { parseChunkGrid, type Cell, type GridMap } from '../src/logic/world/grid';
import { parseChunkObjects, type RawObject } from '../src/logic/world/objects';
import { checkReachability } from '../src/logic/world/reachability';
import { embedTilesets, resolveRelativePath, type TiledMap } from '../src/logic/world/tiled';
import { parseWorld, type TiledWorld } from '../src/logic/world/world';

/**
 * Content checks on the desert, the vertical slice (GAME_DESIGN.md): its size, pickups, depots and
 * enemies, and the gate order hatch_scout → mortar → dozer_blade → boss (Mk3) → steep ramp.
 */
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const WORLD_PATH = 'maps/desert/desert.world';
const readJson = <T>(path: string) => JSON.parse(readFileSync(PUBLIC + path, 'utf8')) as T;

const world = parseWorld(readJson<TiledWorld>(WORLD_PATH), WORLD_PATH);
const chunks = world.chunks.map((chunk) => {
  const map = embedTilesets(readJson<TiledMap>(chunk.path), (src) =>
    readJson(resolveRelativePath(chunk.path, src)),
  );
  const layers = map.layers as { name: string; objects?: RawObject[] }[];
  const objects = layers.find((l) => l.name === 'objects')?.objects ?? [];
  return { chunk, grid: parseChunkGrid(map as unknown as GridMap), objects };
});

const cells = new Map<string, Cell>();
for (const { chunk, grid } of chunks)
  grid.cells.forEach((cell, i) =>
    cells.set(
      `${chunk.cx * CHUNK_W + (i % CHUNK_W)},${chunk.cy * CHUNK_H + Math.floor(i / CHUNK_W)}`,
      cell,
    ),
  );
const cellUnder = (o: { x: number; y: number }) =>
  cells.get(`${Math.floor(o.x / TILE)},${Math.floor(o.y / TILE)}`)!;

const parsed = chunks.map(({ chunk, objects }) => parseChunkObjects(chunk, objects));
const pickups = parsed.flatMap((p) => p.pickups);
const depots = parsed.flatMap((p) => p.depots);
const enemiesFound = parsed.flatMap((p) => p.enemies);
const props = (o: RawObject) =>
  Object.fromEntries((o.properties ?? []).map((p) => [p.name, p.value]));
const rawOfType = (type: string) =>
  chunks.flatMap(({ chunk, objects }) =>
    objects.filter((o) => o.type === type).map((o) => ({ chunk, o, props: props(o) })),
  );

/** Reachability with the objects `drop` picks removed; returns the unreachable names. */
const unreachable = (drop: (o: RawObject) => boolean = () => false) =>
  checkReachability(
    chunks.map(({ chunk, grid, objects }) => ({
      chunk,
      grid,
      objects: objects.filter((o) => !drop(o)),
    })),
  )
    .map((i) => /"([^"]+)"/.exec(i.message)![1]!)
    .sort();
const grants = (ability: string) => (o: RawObject) => props(o).ability === ability;
const isBoss = (o: RawObject) => o.type === 'boss';

describe('desert world', () => {
  it('is in the asset manifest', () => {
    expect(assetManifest.some((a) => a.key === 'world_desert' && a.path === WORLD_PATH)).toBe(true);
  });

  it('has 15–20 chunks', () => {
    expect(world.biome).toBe('desert');
    expect(world.chunks.length).toBeGreaterThanOrEqual(15);
    expect(world.chunks.length).toBeLessThanOrEqual(20);
  });

  it('is enclosed: every chunk edge cell with no neighbour chunk is solid', () => {
    const has = new Set(world.chunks.map((c) => `${c.cx},${c.cy}`));
    for (const { chunk, grid } of chunks)
      grid.cells.forEach((cell, i) => {
        const x = i % CHUNK_W;
        const y = Math.floor(i / CHUNK_W);
        const open =
          (x === 0 && !has.has(`${chunk.cx - 1},${chunk.cy}`)) ||
          (x === CHUNK_W - 1 && !has.has(`${chunk.cx + 1},${chunk.cy}`)) ||
          (y === 0 && !has.has(`${chunk.cx},${chunk.cy - 1}`)) ||
          (y === CHUNK_H - 1 && !has.has(`${chunk.cx},${chunk.cy + 1}`));
        if (open) expect(cell.solid, `${chunk.id} (${x}, ${y})`).toBe(true);
      });
  });

  it('starts on open ground with room for the tank to turn', () => {
    const [start] = rawOfType('spawn').filter((s) => s.o.name === 'start');
    expect(start).toBeDefined();
    const tx = start!.chunk.cx * CHUNK_W + Math.floor(start!.o.x / TILE);
    const ty = start!.chunk.cy * CHUNK_H + Math.floor(start!.o.y / TILE);
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++)
        expect(cells.get(`${tx + dx},${ty + dy}`)!.solid).toBe(false);
  });

  it('has the slice pickups: the three abilities, 2 armor plates, an ammo rack and a repair kit', () => {
    expect(pickups.map((p) => p.ability ?? p.minor).sort()).toEqual(
      [
        'hatch_scout',
        'mortar',
        'dozer_blade',
        'armor_plate',
        'armor_plate',
        'ammo_rack',
        'repair_kit',
      ].sort(),
    );
    for (const p of pickups) expect(cellUnder(p).solid).toBe(false);
  });

  it('has 3 depots, one in the chunk next to the boss arena', () => {
    expect(depots).toHaveLength(3);
    const [boss] = rawOfType('boss');
    const arena = boss!.chunk;
    expect(
      rawOfType('depot').some(
        ({ chunk }) => Math.abs(chunk.cx - arena.cx) + Math.abs(chunk.cy - arena.cy) === 1,
      ),
    ).toBe(true);
  });

  it('uses every desert enemy, each on open ground on its own level', () => {
    const enemies = enemiesFound;
    expect(new Set(enemies.map((e) => e.enemyType))).toEqual(new Set(enemyIds));
    for (const e of enemies) {
      expect(cellUnder(e).solid).toBe(false);
      expect(cellUnder(e).level).toBe(e.level);
    }
  });

  it('has boss_desert in its arena, with the rail inside it', () => {
    const bosses = rawOfType('boss');
    expect(bosses.map((b) => b.props.bossType)).toEqual(['boss_desert']);
    const { chunk, o, props: p } = bosses[0]!;
    const objects = chunks.find((c) => c.chunk.id === chunk.id)!.objects;
    const arena = objects.find((z) => z.type === 'zone' && z.name === p.arena)!;
    const rail = objects.find((r) => r.polyline && r.name === p.rail)!;
    const inside = (x: number, y: number) =>
      x >= arena.x && x <= arena.x + arena.width! && y >= arena.y && y <= arena.y + arena.height!;
    expect(inside(o.x, o.y)).toBe(true);
    for (const pt of rail.polyline!) expect(inside(rail.x + pt.x, rail.y + pt.y)).toBe(true);
  });

  it('opens up in order: everything is reachable', () => {
    expect(unreachable()).toEqual([]);
  });

  it('without the hatch, the crossroads door holds back everything past it', () => {
    expect(unreachable(grants('hatch_scout'))).toEqual(
      [
        'armor_plate_1',
        'mortar',
        'depot_b',
        'dozer_blade',
        'depot_c',
        'ammo_rack_1',
        'bunker',
        'armor_plate_2',
        'radio_bunkers',
        'radio_mortar',
        'radio_dozer',
        'radio_steep',
        'radio_boss_approach',
        'radio_final_01',
        'radio_final_02',
      ].sort(),
    );
  });

  it('without the mortar, the dozer yard (and all after it) stays shut', () => {
    expect(unreachable(grants('mortar'))).toEqual(
      [
        'dozer_blade',
        'depot_c',
        'ammo_rack_1',
        'bunker',
        'armor_plate_2',
        'radio_dozer',
        'radio_steep',
        'radio_boss_approach',
        'radio_final_01',
        'radio_final_02',
      ].sort(),
    );
  });

  it('without the dozer, rubble blocks the boss approach and the rubble pass', () => {
    expect(unreachable(grants('dozer_blade'))).toEqual(
      [
        'depot_c',
        'ammo_rack_1',
        'bunker',
        'armor_plate_2',
        'radio_boss_approach',
        'radio_final_01',
        'radio_final_02',
      ].sort(),
    );
  });

  it('without the boss (no Mk3), the plateau behind the steep ramp is out of reach', () => {
    expect(unreachable(isBoss)).toEqual(['armor_plate_2', 'radio_final_01', 'radio_final_02']);
  });

  it('has a steep ramp on the way to the plateau, which is level 2', () => {
    expect([...cells.values()].some((c) => c.ramp && c.steep)).toBe(true);
    const finals = rawOfType('radio').filter((r) => String(r.props.id).startsWith('radio_final'));
    expect(finals).toHaveLength(2);
    for (const { chunk, o } of finals) {
      const x = chunk.cx * CHUNK_W * TILE + o.x + o.width! / 2;
      const y = chunk.cy * CHUNK_H * TILE + o.y + o.height! / 2;
      expect(cellUnder({ x, y }).level).toBe(2);
    }
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assetManifest } from '../src/data/assetManifest';
import { resolveRelativePath } from '../src/logic/world/tiled';

/** Structural checks on the M1 test room until validate:maps enforces the real rules (M2). */
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const MAP_PATH = 'maps/test/test_room.tmj';

interface Layer {
  name: string;
  data?: number[];
  visible?: boolean;
  objects?: { name: string; type: string; x: number; y: number }[];
}
interface Tileset {
  name: string;
  image: string;
  tiles?: { id: number; properties?: { name: string; value: unknown }[] }[];
}
interface TiledMapFile {
  width: number;
  height: number;
  tilewidth: number;
  layers: Layer[];
  tilesets: { firstgid: number; source?: string }[];
}

const readJson = <T>(path: string) => JSON.parse(readFileSync(PUBLIC + path, 'utf8')) as T;
const map = readJson<TiledMapFile>(MAP_PATH);
const layer = (name: string) => map.layers.find((l) => l.name === name)!;

describe('test room map', () => {
  it('is in the asset manifest', () => {
    expect(assetManifest.some((a) => a.path === MAP_PATH)).toBe(true);
  });

  it('has the LEVEL_DESIGN.md layers in order, with elevation hidden', () => {
    expect(map.layers.map((l) => l.name)).toEqual([
      'ground',
      'elevation',
      'walls',
      'decor',
      'above',
      'objects',
    ]);
    expect(layer('elevation').visible).toBe(false);
  });

  it('uses only external tilesets whose name is a manifest image key', () => {
    for (const ref of map.tilesets) {
      expect(ref.source).toBeDefined();
      const tsPath = resolveRelativePath(MAP_PATH, ref.source!);
      const ts = readJson<Tileset>(tsPath);
      expect(assetManifest.some((a) => a.key === ts.name && a.type === 'image')).toBe(true);
      expect(existsSync(PUBLIC + resolveRelativePath(tsPath, ts.image))).toBe(true);
    }
  });

  describe('walls', () => {
    const ts = readJson<Tileset>('maps/test/placeholder.tsj');
    const firstgid = map.tilesets[0]!.firstgid;
    const solidGids = new Set(
      (ts.tiles ?? [])
        .filter((t) => t.properties?.some((p) => p.name === 'solid' && p.value === true))
        .map((t) => t.id + firstgid),
    );
    const walls = layer('walls').data!;
    const solidAt = (tx: number, ty: number) => solidGids.has(walls[ty * map.width + tx]!);

    it('only uses solid tiles on the walls layer', () => {
      for (const gid of walls) if (gid !== 0) expect(solidGids.has(gid)).toBe(true);
    });

    it('encloses the room with a solid border', () => {
      for (let x = 0; x < map.width; x++) {
        expect(solidAt(x, 0)).toBe(true);
        expect(solidAt(x, map.height - 1)).toBe(true);
      }
      for (let y = 0; y < map.height; y++) {
        expect(solidAt(0, y)).toBe(true);
        expect(solidAt(map.width - 1, y)).toBe(true);
      }
    });

    it('has a start spawn with room for the tank (no wall within 2 tiles)', () => {
      const start = layer('objects').objects!.find((o) => o.type === 'spawn' && o.name === 'start');
      expect(start).toBeDefined();
      const tx = Math.floor(start!.x / map.tilewidth);
      const ty = Math.floor(start!.y / map.tilewidth);
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) expect(solidAt(tx + dx, ty + dy)).toBe(false);
    });
  });
});

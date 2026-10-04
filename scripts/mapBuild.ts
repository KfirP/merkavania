import type { ChunkLayout, LayoutObject, PropValue } from './mapLayout';

/**
 * Builds Tiled chunk maps and the `.world` file from `ChunkLayout`s (scripts/mapLayout.ts). Pure:
 * `scripts/build-maps.ts` reads the layouts and writes the files. Ground is shaded per level, the
 * edges of higher ground get a rim and ramps an arrow overlay (both on the `walls` layer, not
 * solid), and plain ground gets a seeded scatter of small decor, so a rebuild is byte-identical.
 */

const W = 30;
const H = 17;
const TILE = 16;
const ELEVATION_SOURCE = '../shared/elevation.tsj';
const DIRS = ['n', 'e', 's', 'w'] as const;
type Dir = (typeof DIRS)[number];
const STEP: Record<Dir, [number, number]> = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

/** Rim edge bits: which sides of a high cell drop to lower ground. */
export const RIM = { n: 1, e: 2, s: 4, w: 8 } as const;

/** A biome tileset as the builder sees it; tile ids are local (0-based) to that tileset. */
export interface TilePalette {
  /** The tileset file, relative to the chunk files. */
  source: string;
  tilecount: number;
  /** Ground legend: per char, tile variants by level (0–3); `wall` makes it solid on `walls`. */
  ground: Record<string, { tiles: number[][]; wall?: number }>;
  ramp(dir: Dir, steep: boolean): number;
  /** Rim overlay for a mask of `RIM` bits (1–15). */
  rim(mask: number): number;
  /** Decor and above legends: a block of tiles (rows) anchored at the character. */
  decor: Record<string, number[][]>;
  above: Record<string, number[][]>;
  /** Small decor scattered over plain `on` ground. */
  scatter: { on: string; chance: number; tiles: number[] };
}

export interface ElevationCell {
  level: number;
  ramp: Dir | null;
  steep: boolean;
}

function checkGrid(rows: readonly string[], what: string): void {
  if (rows.length !== H) throw new Error(`${what} must have ${H} rows, got ${rows.length}`);
  rows.forEach((r, y) => {
    if (r.length !== W)
      throw new Error(`${what} row ${y} must be ${W} characters, got ${r.length}`);
  });
}

/** Reads an `elev` grid; see scripts/mapLayout.ts for the legend and the ramp-level rule. */
export function parseElevation(rows: readonly string[]): ElevationCell[] {
  checkGrid(rows, 'elev');
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? null : rows[y]![x]!);
  const cells: ElevationCell[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ch = rows[y]![x]!;
      if (ch === '.' || (ch >= '0' && ch <= '3')) {
        cells.push({ level: ch === '.' ? 0 : Number(ch), ramp: null, steep: false });
        continue;
      }
      const dir = ch.toLowerCase() as Dir;
      if (!DIRS.includes(dir)) throw new Error(`elev row ${y}: unknown character "${ch}"`);
      const [dx, dy] = STEP[dir];
      // Walk along the run of ramp cells going this way to the level at either end.
      const levelAt = (sign: 1 | -1): number | null => {
        let [cx, cy] = [x, y];
        for (;;) {
          cx += dx * sign;
          cy += dy * sign;
          const c = at(cx, cy);
          if (c === null) return null;
          if (c === '.') return 0;
          if (c >= '0' && c <= '3') return Number(c);
          if (c.toLowerCase() !== dir) return null;
        }
      };
      const behind = levelAt(-1);
      const front = levelAt(1);
      const level = behind ?? (front === null ? null : front - 1);
      if (level === null || level < 0 || level > 2 || (front !== null && front - 1 !== level))
        throw new Error(
          `elev: ramp at (${x}, ${y}) has no consistent level (behind ${behind}, in front ${front})`,
        );
      cells.push({ level, ramp: dir, steep: ch !== dir });
    }
  return cells;
}

/** mulberry32, seeded from a string (FNV-1a). */
function rng(seed: string): () => number {
  let a = 0x811c9dc5;
  for (const ch of seed) a = Math.imul(a ^ ch.charCodeAt(0), 0x01000193);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Elevation tileset ids (maps/shared/elevation.tsj). */
function elevationId({ level, ramp, steep }: ElevationCell): number | null {
  if (!ramp) return level === 0 ? null : level;
  const d = DIRS.indexOf(ramp);
  return (steep ? 16 : 4) + level * 4 + d;
}

function tiledProperties(props: Record<string, PropValue> = {}) {
  return Object.entries(props).map(([name, value]) => ({
    name,
    type:
      typeof value === 'boolean'
        ? 'bool'
        : typeof value === 'number'
          ? Number.isInteger(value)
            ? 'int'
            : 'float'
          : 'string',
    value,
  }));
}

function tiledObject(o: LayoutObject, id: number) {
  return {
    id,
    name: o.name ?? '',
    type: o.type,
    x: o.x,
    y: o.y,
    width: o.width ?? 0,
    height: o.height ?? 0,
    rotation: o.rotation ?? 0,
    visible: true,
    ...(o.point ? { point: true } : {}),
    ...(o.polyline ? { polyline: o.polyline } : {}),
    ...(o.properties && Object.keys(o.properties).length
      ? { properties: tiledProperties(o.properties) }
      : {}),
  };
}

/** Places a legend's blocks into `out` (gids); throws on unknown characters or overflow. */
function placeBlocks(
  rows: readonly string[] | undefined,
  legend: Record<string, number[][]>,
  what: string,
  out: number[],
): void {
  if (!rows) return;
  checkGrid(rows, what);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const block = legend[ch];
      if (!block) throw new Error(`${what} row ${y}: unknown character "${ch}"`);
      block.forEach((tiles, by) =>
        tiles.forEach((id, bx) => {
          if (x + bx >= W || y + by >= H)
            throw new Error(`${what} row ${y}: "${ch}" at column ${x} runs off the chunk`);
          out[(y + by) * W + x + bx] = id + 1;
        }),
      );
    }),
  );
}

export interface BuiltWorld {
  world: {
    maps: { fileName: string; height: number; width: number; x: number; y: number }[];
    onlyShowAdjacentMaps: false;
    type: 'world';
  };
  /** File name → Tiled map JSON. */
  maps: Map<string, unknown>;
}

const coordOf = (key: string) => {
  const m = /^x(\d+)_y(\d+)$/.exec(key);
  if (!m) throw new Error(`chunk key "${key}" must look like x00_y00`);
  return { cx: Number(m[1]), cy: Number(m[2]) };
};

/** Builds every chunk of a biome; layout keys are `x<XX>_y<YY>`. */
export function buildWorld(
  biome: string,
  layouts: ReadonlyMap<string, ChunkLayout>,
  palette: TilePalette,
): BuiltWorld {
  const keys = [...layouts.keys()].sort();
  // First pass: elevation and solidity everywhere, so rims can look across chunk edges.
  const elevation = new Map<string, ElevationCell>();
  const solid = new Set<string>();
  const tileKey = (tx: number, ty: number) => `${tx},${ty}`;
  for (const key of keys) {
    const { cx, cy } = coordOf(key);
    const layout = layouts.get(key)!;
    const where = `${biome}_${key}`;
    try {
      checkGrid(layout.ground, 'ground');
      const cells = parseElevation(layout.elev);
      cells.forEach((cell, i) => {
        const tk = tileKey(cx * W + (i % W), cy * H + Math.floor(i / W));
        elevation.set(tk, cell);
        const ch = layout.ground[Math.floor(i / W)]![i % W]!;
        const g = palette.ground[ch];
        if (!g) throw new Error(`ground row ${Math.floor(i / W)}: unknown character "${ch}"`);
        if (g.wall !== undefined) solid.add(tk);
      });
    } catch (e) {
      throw new Error(`${where}: ${(e as Error).message}`, { cause: e });
    }
  }

  const elevFirstGid = palette.tilecount + 1;
  const maps = new Map<string, unknown>();
  for (const key of keys) {
    const { cx, cy } = coordOf(key);
    const layout = layouts.get(key)!;
    const where = `${biome}_${key}`;
    const rand = rng(where);
    const ground: number[] = [];
    const elev: number[] = [];
    const walls: number[] = [];
    const decor = new Array<number>(W * H).fill(0);
    const above = new Array<number>(W * H).fill(0);
    try {
      placeBlocks(layout.decor, palette.decor, 'decor', decor);
      placeBlocks(layout.above, palette.above, 'above', above);
    } catch (e) {
      throw new Error(`${where}: ${(e as Error).message}`, { cause: e });
    }

    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const tx = cx * W + x;
        const ty = cy * H + y;
        const cell = elevation.get(tileKey(tx, ty))!;
        const ch = layout.ground[y]![x]!;
        const g = palette.ground[ch]!;
        const variants = g.tiles[cell.level] ?? g.tiles[0]!;
        ground.push(variants[Math.floor(rand() * variants.length)]! + 1);
        const e = elevationId(cell);
        elev.push(e === null ? 0 : elevFirstGid + e);

        let wall = 0;
        if (g.wall !== undefined) wall = g.wall + 1;
        else if (cell.ramp) wall = palette.ramp(cell.ramp, cell.steep) + 1;
        else {
          let mask = 0;
          for (const d of DIRS) {
            const [dx, dy] = STEP[d];
            const nk = tileKey(tx + dx, ty + dy);
            const n = elevation.get(nk);
            if (!n || solid.has(nk) || n.level >= cell.level) continue;
            // The ramp that climbs into this cell from that side.
            const opposite = DIRS[(DIRS.indexOf(d) + 2) % 4];
            if (n.ramp === opposite && n.level === cell.level - 1) continue;
            mask |= RIM[d];
          }
          if (mask) wall = palette.rim(mask) + 1;
        }
        walls.push(wall);

        const roll = rand();
        const i = y * W + x;
        if (
          ch === palette.scatter.on &&
          wall === 0 &&
          decor[i] === 0 &&
          roll < palette.scatter.chance
        )
          decor[i] =
            palette.scatter.tiles[
              Math.floor((roll / palette.scatter.chance) * palette.scatter.tiles.length)
            ]! + 1;
      }

    const objects = (layout.objects ?? []).map((o, i) => tiledObject(o, i + 1));
    const tileLayer = (id: number, name: string, data: number[], visible = true) => ({
      data,
      height: H,
      id,
      name,
      opacity: 1,
      type: 'tilelayer',
      visible,
      width: W,
      x: 0,
      y: 0,
    });
    maps.set(`${where}.tmj`, {
      compressionlevel: -1,
      height: H,
      infinite: false,
      layers: [
        tileLayer(1, 'ground', ground),
        tileLayer(2, 'elevation', elev, false),
        tileLayer(3, 'walls', walls),
        tileLayer(4, 'decor', decor),
        tileLayer(5, 'above', above),
        {
          draworder: 'topdown',
          id: 6,
          name: 'objects',
          objects,
          opacity: 1,
          type: 'objectgroup',
          visible: true,
          x: 0,
          y: 0,
        },
      ],
      nextlayerid: 7,
      nextobjectid: objects.length + 1,
      orientation: 'orthogonal',
      renderorder: 'right-down',
      tiledversion: '1.11.2',
      tileheight: TILE,
      tilesets: [
        { firstgid: 1, source: palette.source },
        { firstgid: elevFirstGid, source: ELEVATION_SOURCE },
      ],
      tilewidth: TILE,
      type: 'map',
      version: '1.10',
      width: W,
    });
  }

  return {
    world: {
      maps: keys.map((key) => {
        const { cx, cy } = coordOf(key);
        return {
          fileName: `${biome}_${key}.tmj`,
          height: H * TILE,
          width: W * TILE,
          x: cx * W * TILE,
          y: cy * H * TILE,
        };
      }),
      onlyShowAdjacentMaps: false,
      type: 'world',
    },
    maps,
  };
}

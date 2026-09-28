import { CHUNK_H, CHUNK_W, type ChunkCoord } from './chunks';

/** Direction of travel; for a ramp, the direction that goes **up** (LEVEL_DESIGN.md). */
export type Dir = 'n' | 's' | 'e' | 'w';

/** Everything movement cares about in one tile cell. */
export interface Cell {
  /** Elevation; for a ramp, its low end. */
  level: number;
  ramp: Dir | null;
  steep: boolean;
  /** `terrain` of the ground tile, or null where there is none. */
  terrain: string | null;
  solid: boolean;
}

export interface ChunkGrid {
  width: number;
  height: number;
  /** Row-major, `y * width + x`. */
  cells: Cell[];
}

interface TiledProperty {
  name: string;
  type?: string;
  value: unknown;
}

export interface GridTileset {
  firstgid: number;
  tiles?: { id: number; properties?: TiledProperty[] }[];
}

export interface GridLayer {
  name: string;
  type: string;
  data?: number[];
  objects?: unknown[];
}

/** The parts of a Tiled map (with tilesets inlined) the grid needs. */
export interface GridMap {
  width: number;
  height: number;
  tilesets: GridTileset[];
  layers: GridLayer[];
}

/** Tiled stores flip/rotation flags in the top bits of a gid. */
const GID_MASK = 0x1fffffff;

type Props = Record<string, unknown>;

/** gid → tile properties, across every tileset in the map. */
export function tilePropertyLookup(tilesets: readonly GridTileset[]): (gid: number) => Props {
  const byGid = new Map<number, Props>();
  for (const ts of tilesets)
    for (const tile of ts.tiles ?? []) {
      const props: Props = {};
      for (const p of tile.properties ?? []) props[p.name] = p.value;
      byGid.set(ts.firstgid + tile.id, props);
    }
  const empty: Props = {};
  return (gid) => byGid.get(gid & GID_MASK) ?? empty;
}

export function parseChunkGrid(map: GridMap): ChunkGrid {
  const props = tilePropertyLookup(map.tilesets);
  const layer = (name: string) => map.layers.find((l) => l.name === name)?.data;
  const ground = layer('ground');
  const elevation = layer('elevation');
  const walls = layer('walls');

  const cells: Cell[] = [];
  for (let i = 0; i < map.width * map.height; i++) {
    const g = props(ground?.[i] ?? 0);
    const e = props(elevation?.[i] ?? 0);
    const w = props(walls?.[i] ?? 0);
    cells.push({
      level: typeof e.level === 'number' ? e.level : 0,
      ramp: typeof e.ramp === 'string' ? (e.ramp as Dir) : null,
      steep: e.steep === true,
      terrain: typeof g.terrain === 'string' ? g.terrain : null,
      solid: w.solid === true,
    });
  }
  return { width: map.width, height: map.height, cells };
}

const key = ({ cx, cy }: ChunkCoord) => `${cx},${cy}`;

/** The loaded chunks' grids, addressed by world tile coordinates. */
export class WorldGrid {
  private readonly chunks = new Map<string, ChunkGrid>();

  add(coord: ChunkCoord, grid: ChunkGrid): void {
    this.chunks.set(key(coord), grid);
  }

  remove(coord: ChunkCoord): void {
    this.chunks.delete(key(coord));
  }

  /** The cell at world tile (tx, ty), or null if its chunk isn't loaded. */
  cellAt(tx: number, ty: number): Cell | null {
    const cx = Math.floor(tx / CHUNK_W);
    const cy = Math.floor(ty / CHUNK_H);
    const grid = this.chunks.get(key({ cx, cy }));
    if (!grid) return null;
    return grid.cells[(ty - cy * CHUNK_H) * grid.width + (tx - cx * CHUNK_W)] ?? null;
  }
}

import { CHUNK_PX_H, CHUNK_PX_W, type ChunkCoord } from './chunks';

/**
 * The map screen (GAME_DESIGN.md, Save & depots): the chunks you've explored, depots, and the
 * pickups in explored chunks, taken or not. Laid out here in screen px; MapScene only draws it.
 */

/** What the map needs from a chunk's objects (a subset of `ChunkObjects`). */
export interface MapObjects {
  depots: readonly { key: string; x: number; y: number }[];
  pickups: readonly { key: string; x: number; y: number }[];
}

export type MapMarkerKind = 'depot' | 'pickup' | 'pickup_taken';

export interface MapMarker {
  kind: MapMarkerKind;
  key: string;
  x: number;
  y: number;
}

export interface MapCell {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  current: boolean;
}

export interface MapView {
  cells: MapCell[];
  markers: MapMarker[];
  /** The active pawn, screen px. */
  pawn: { x: number; y: number };
}

export interface MapInput {
  chunks: readonly (ChunkCoord & { id: string })[];
  visited: readonly string[];
  current: string;
  /** The active pawn, world px. */
  pawn: { x: number; y: number };
  objectsOf(chunkId: string): MapObjects;
  /** Whether a pickup's key is flagged as taken. */
  taken(key: string): boolean;
  /** Where the map may be drawn, screen px. */
  area: { x: number; y: number; width: number; height: number };
}

export function buildMapView(input: MapInput): MapView {
  const { chunks, area } = input;
  if (chunks.length === 0) return { cells: [], markers: [], pawn: { x: area.x, y: area.y } };

  // The whole world's grid sets the scale, so the map doesn't jump around as you explore.
  const minCx = Math.min(...chunks.map((c) => c.cx));
  const minCy = Math.min(...chunks.map((c) => c.cy));
  const cols = Math.max(...chunks.map((c) => c.cx)) - minCx + 1;
  const rows = Math.max(...chunks.map((c) => c.cy)) - minCy + 1;
  const scale = Math.min(area.width / (cols * CHUNK_PX_W), area.height / (rows * CHUNK_PX_H));
  const w = Math.floor(CHUNK_PX_W * scale);
  const h = Math.floor(CHUNK_PX_H * scale);
  const x0 = area.x + Math.floor((area.width - cols * w) / 2);
  const y0 = area.y + Math.floor((area.height - rows * h) / 2);
  const toScreen = (wx: number, wy: number) => ({
    x: x0 + ((wx - minCx * CHUNK_PX_W) * w) / CHUNK_PX_W,
    y: y0 + ((wy - minCy * CHUNK_PX_H) * h) / CHUNK_PX_H,
  });

  const seen = new Set(input.visited);
  const visited = chunks.filter((c) => seen.has(c.id));
  const cells = visited.map((c) => ({
    id: c.id,
    x: x0 + (c.cx - minCx) * w,
    y: y0 + (c.cy - minCy) * h,
    w,
    h,
    current: c.id === input.current,
  }));

  const markers: MapMarker[] = [];
  for (const c of visited) {
    const objects = input.objectsOf(c.id);
    for (const d of objects.depots)
      markers.push({ kind: 'depot', key: d.key, ...toScreen(d.x, d.y) });
    for (const p of objects.pickups)
      markers.push({
        kind: input.taken(p.key) ? 'pickup_taken' : 'pickup',
        key: p.key,
        ...toScreen(p.x, p.y),
      });
  }

  return { cells, markers, pawn: toScreen(input.pawn.x, input.pawn.y) };
}

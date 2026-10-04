/**
 * The source format for built maps (docs/LEVEL_DESIGN.md, Built maps): one `ChunkLayout` per chunk
 * under `maps-src/<biome>/`, turned into Tiled files by `scripts/build-maps.ts`. Grids are 17 rows
 * of 30 characters; object helpers take tile coordinates and place points on tile centres.
 *
 * - `ground`: one character per tile, from the biome palette's legend (sand, road, walls, …).
 * - `elev`: `0`–`3` (or `.` for 0) is a level; `n`/`e`/`s`/`w` is a ramp going **up** that way,
 *   upper case for a steep one. A ramp's level (its low end) is the level behind it, or one below
 *   the level in front of it, following runs of ramp cells.
 * - `decor`/`above`: optional extra detail from the palette's legend; `.` is empty.
 */

export type PropValue = string | number | boolean;

export interface LayoutObject {
  type: string;
  name?: string;
  /** Pixels within the chunk: a point, or a rect's top-left corner. */
  x: number;
  y: number;
  width?: number;
  height?: number;
  point?: boolean;
  /** Degrees clockwise (Tiled). */
  rotation?: number;
  /** Relative to (x, y), px. */
  polyline?: { x: number; y: number }[];
  properties?: Record<string, PropValue>;
}

export interface ChunkLayout {
  ground: string[];
  elev: string[];
  decor?: string[];
  above?: string[];
  objects?: LayoutObject[];
}

const T = 16;
const centre = (t: number) => t * T + T / 2;

/** Identity: gives a layout module its type. */
export const chunk = (layout: ChunkLayout): ChunkLayout => layout;

const point = (
  type: string,
  tx: number,
  ty: number,
  properties: Record<string, PropValue>,
  extra: Partial<LayoutObject> = {},
): LayoutObject => ({ type, x: centre(tx), y: centre(ty), point: true, properties, ...extra });

const rect = (
  type: string,
  tx: number,
  ty: number,
  tw: number,
  th: number,
  properties: Record<string, PropValue>,
  extra: Partial<LayoutObject> = {},
): LayoutObject => ({
  type,
  x: tx * T,
  y: ty * T,
  width: tw * T,
  height: th * T,
  properties,
  ...extra,
});

export const spawn = (name: string, tx: number, ty: number): LayoutObject =>
  point('spawn', tx, ty, {}, { name });

/** A 32×32 pad centred on the corner between tiles (tx-1..tx, ty-1..ty). */
export const depot = (id: string, tx: number, ty: number): LayoutObject => ({
  type: 'depot',
  x: tx * T - T,
  y: ty * T - T,
  width: 2 * T,
  height: 2 * T,
  properties: { id },
});

export const pickup = (
  id: string,
  grant: { ability: string } | { minor: string },
  tx: number,
  ty: number,
): LayoutObject => point('pickup', tx, ty, { id, ...grant });

export const enemy = (
  enemyType: string,
  level: number,
  tx: number,
  ty: number,
  opts: { facing?: number; patrol?: string } = {},
): LayoutObject =>
  point(
    'enemy',
    tx,
    ty,
    { enemyType, level, ...(opts.patrol ? { patrol: opts.patrol } : {}) },
    { rotation: opts.facing ?? 0 },
  );

/** A polyline through tile centres; patrols loop, so close it by repeating the first point. */
export const path = (name: string, tiles: [number, number][]): LayoutObject => {
  const [tx0, ty0] = tiles[0]!;
  return {
    type: '',
    name,
    x: centre(tx0),
    y: centre(ty0),
    polyline: tiles.map(([tx, ty]) => ({ x: (tx - tx0) * T, y: (ty - ty0) * T })),
  };
};

export const destructible = (
  id: string,
  material: string,
  tx: number,
  ty: number,
  tw = 1,
  th = 1,
): LayoutObject => rect('destructible', tx, ty, tw, th, { id, material });

export const boulder = (id: string, tx: number, ty: number): LayoutObject =>
  point('boulder', tx, ty, { id });

export const lever = (id: string, activatedBy: string, tx: number, ty: number): LayoutObject =>
  point('switch', tx, ty, { id, activatedBy });

export const door = (
  id: string,
  opensWith: string,
  tx: number,
  ty: number,
  tw: number,
  th: number,
): LayoutObject => rect('door', tx, ty, tw, th, { id, opensWith });

/** A radio trigger rect (the message plays when the active pawn enters it). */
export const radio = (
  id: string,
  messageKey: string,
  tx: number,
  ty: number,
  tw: number,
  th: number,
  opts: { once?: boolean; speaker?: string } = {},
): LayoutObject => rect('radio', tx, ty, tw, th, { id, messageKey, ...opts });

export const zone = (
  name: string,
  kind: string,
  tx: number,
  ty: number,
  tw: number,
  th: number,
): LayoutObject => rect('zone', tx, ty, tw, th, { kind }, { name });

export const boss = (
  id: string,
  bossType: string,
  tx: number,
  ty: number,
  opts: { arena: string; rail: string },
): LayoutObject => point('boss', tx, ty, { id, bossType, ...opts });

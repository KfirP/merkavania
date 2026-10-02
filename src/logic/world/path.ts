import { TILE } from './chunks';
import type { Dir } from './grid';
import { canEnter, type CellLookup, type MoveContext } from './traversal';

/** Tiles a recall may search before giving up. */
const MAX_NODES = 4000;

const STEPS: [Dir, number, number][] = [
  ['n', 0, -1],
  ['s', 0, 1],
  ['e', 1, 0],
  ['w', -1, 0],
];

/**
 * Shortest 4-neighbour walk over the cell grid under the movement rules (the scout's recall).
 * Returns the tile centres to walk through, ending on the goal and excluding the start; an empty
 * list when already there; null when there's no way or the search ran past `maxNodes`.
 */
export function findPath(
  cellAt: CellLookup,
  from: { tx: number; ty: number },
  to: { tx: number; ty: number },
  ctx: MoveContext,
  maxNodes = MAX_NODES,
): { x: number; y: number }[] | null {
  const key = (tx: number, ty: number) => `${tx},${ty}`;
  const goal = key(to.tx, to.ty);
  const cameFrom = new Map<string, string | null>([[key(from.tx, from.ty), null]]);
  const queue: [number, number][] = [[from.tx, from.ty]];

  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head]!;
    if (key(x, y) === goal) return walkBack(cameFrom, goal);
    if (cameFrom.size > maxNodes) return null;
    const here = cellAt(x, y);
    for (const [dir, dx, dy] of STEPS) {
      const next = key(x + dx, y + dy);
      if (cameFrom.has(next) || !canEnter(here, cellAt(x + dx, y + dy), dir, ctx)) continue;
      cameFrom.set(next, key(x, y));
      queue.push([x + dx, y + dy]);
    }
  }
  return null;
}

function walkBack(cameFrom: Map<string, string | null>, goal: string) {
  const path: { x: number; y: number }[] = [];
  for (let k: string | null = goal; cameFrom.get(k) != null; k = cameFrom.get(k)!) {
    const [tx, ty] = k.split(',').map(Number) as [number, number];
    path.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
  }
  return path.reverse();
}

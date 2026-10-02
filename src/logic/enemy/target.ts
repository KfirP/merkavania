/** Which player pawn an enemy goes after: the tank, or the scout while it's out. */

type Vec2 = { x: number; y: number };

export interface TargetCandidate {
  readonly pos: Vec2;
  readonly level: number;
  readonly alive: boolean;
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/** The nearest living candidate, or null. */
export function closestAlive<T extends TargetCandidate>(from: Vec2, candidates: readonly T[]) {
  let best: T | null = null;
  for (const c of candidates)
    if (c.alive && (!best || dist(from, c.pos) < dist(from, best.pos))) best = c;
  return best;
}

/**
 * The closest pawn the enemy can see (same level, in range, line of sight). With none in sight it
 * keeps the closest living one, unseen, so the brain can hunt its last known position.
 */
export function pickTarget<T extends TargetCandidate>(
  self: Vec2,
  level: number,
  candidates: readonly T[],
  sightRange: number,
  lineOfSight: (from: Vec2, to: Vec2) => boolean,
): { target: T | null; visible: boolean } {
  const seen = candidates.filter(
    (c) =>
      c.alive && c.level === level && dist(self, c.pos) <= sightRange && lineOfSight(self, c.pos),
  );
  const visible = closestAlive(self, seen);
  if (visible) return { target: visible, visible: true };
  return { target: closestAlive(self, candidates), visible: false };
}

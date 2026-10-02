/**
 * Scout movement (docs/ARCHITECTURE.md, Pawns): throttle/turn read as direct 8-way motion in
 * screen space, kept on a leash around the tank.
 */

type Vec2 = { x: number; y: number };
type Velocity = { vx: number; vy: number };

/** Throttle walks screen-up, turn walks right; diagonals are no faster than straight lines. */
export function scoutVelocity(throttle: number, turn: number, speed: number): Velocity {
  const x = turn;
  const y = -throttle;
  const len = Math.hypot(x, y);
  if (len === 0) return { vx: 0, vy: 0 };
  const k = (len > 1 ? 1 / len : 1) * speed;
  return { vx: x * k + 0, vy: y * k + 0 };
}

/** At the end of the leash, drops the part of the motion that leads further away. */
export function limitToLeash(pos: Vec2, v: Velocity, anchor: Vec2, leash: number): Velocity {
  const dx = pos.x - anchor.x;
  const dy = pos.y - anchor.y;
  const dist = Math.hypot(dx, dy);
  if (dist < leash || dist === 0) return v;
  const nx = dx / dist;
  const ny = dy / dist;
  const outward = v.vx * nx + v.vy * ny;
  if (outward <= 0) return v;
  return { vx: v.vx - nx * outward, vy: v.vy - ny * outward };
}

/** A point beyond the leash, pulled back onto it. */
export function clampLeash(pos: Vec2, anchor: Vec2, leash: number): Vec2 {
  const dx = pos.x - anchor.x;
  const dy = pos.y - anchor.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= leash) return pos;
  return { x: anchor.x + (dx / dist) * leash, y: anchor.y + (dy / dist) * leash };
}

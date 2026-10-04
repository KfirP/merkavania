/** Share of splash damage at `dist` px from the blast: 1 at the centre, falling linearly to 0 at `radius`. */
export function splashFalloff(dist: number, radius: number): number {
  if (radius <= 0 || dist >= radius) return 0;
  return 1 - dist / radius;
}

/** Distance from `p` to a rect given by its centre and half-size: 0 inside (big targets). */
export function distanceToRect(
  p: { x: number; y: number },
  r: { x: number; y: number; halfW: number; halfH: number },
): number {
  const dx = Math.max(0, Math.abs(p.x - r.x) - r.halfW);
  const dy = Math.max(0, Math.abs(p.y - r.y) - r.halfH);
  return Math.hypot(dx, dy);
}

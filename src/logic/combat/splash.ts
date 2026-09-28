/** Share of splash damage at `dist` px from the blast: 1 at the centre, falling linearly to 0 at `radius`. */
export function splashFalloff(dist: number, radius: number): number {
  if (radius <= 0 || dist >= radius) return 0;
  return 1 - dist / radius;
}

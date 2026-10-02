/**
 * The 60mm mortar's arc (docs/ARCHITECTURE.md, Elevation): it flies over walls and levels to a
 * chosen spot and lands on the level of the cell there.
 */

export interface LobRange {
  minRange: number;
  maxRange: number;
}

/** Where a shell aimed `angle` at `distance` lands (null = full range), clamped to the range. */
export function lobTarget(
  origin: { x: number; y: number },
  angle: number,
  distance: number | null,
  { minRange, maxRange }: LobRange,
): { x: number; y: number; distance: number } {
  const d = Math.min(maxRange, Math.max(minRange, distance ?? maxRange));
  return { x: origin.x + Math.cos(angle) * d, y: origin.y + Math.sin(angle) * d, distance: d };
}

/** Shortest flight, s, so even a point-blank lob shows an arc. */
const MIN_FLIGHT = 0.2;

/** Seconds in the air: ground distance over ground speed. */
export function flightTime(distance: number, speed: number): number {
  return Math.max(MIN_FLIGHT, distance / speed);
}

/** Height above the ground at progress `t` (0..1) of the flight: a parabola peaking at `apex`. */
export function arcHeight(t: number, apex: number): number {
  const p = Math.min(1, Math.max(0, t));
  return 4 * apex * p * (1 - p);
}

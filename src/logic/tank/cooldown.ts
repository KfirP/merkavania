/** A simple fire-rate limiter (e.g. the coax MG): returns the remaining cooldown and whether it fired. */
export function tickCooldown(remaining: number, dt: number): number {
  return Math.max(0, remaining - dt);
}

export function tryTrigger(
  remaining: number,
  interval: number,
): { remaining: number; fired: boolean } {
  if (remaining > 0) return { remaining, fired: false };
  return { remaining: interval, fired: true };
}

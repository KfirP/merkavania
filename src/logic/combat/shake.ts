import { SHAKE } from '../../data/combat';

/** Camera shake intensity for the player taking `damage`. */
export function hitShake(damage: number): number {
  return Math.min(SHAKE.maxIntensity, Math.max(0, damage) * SHAKE.perDamage);
}

/**
 * Camera shake intensity for an explosion `dist` px from the camera centre; `size` scales it
 * (1 = a main-gun shell). Fades linearly to 0 at `SHAKE.explosionRange`.
 */
export function explosionShake(dist: number, size: number): number {
  if (dist >= SHAKE.explosionRange) return 0;
  const i = SHAKE.explosionIntensity * size * (1 - dist / SHAKE.explosionRange);
  return Math.min(SHAKE.maxIntensity, i);
}

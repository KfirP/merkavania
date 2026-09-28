/**
 * Main-gun "quick rounds" (docs/GAME_DESIGN.md): the gun fires up to `quickRounds` shots, each
 * followed by `cooldown`. Emptying it starts a refill of `quickRounds × refillPerRound` seconds
 * during which the gun can't fire; the refill restores every round at once.
 */
export interface MainGunStats {
  quickRounds: number;
  /** Seconds between shots. */
  cooldown: number;
  /** Refill seconds per quick round. */
  refillPerRound: number;
}

export interface MainGunState {
  rounds: number;
  cooldown: number;
  /** Seconds left on the refill; 0 when not refilling. */
  refill: number;
}

export function initialGun(stats: MainGunStats): MainGunState {
  return { rounds: stats.quickRounds, cooldown: 0, refill: 0 };
}

export function tickGun(state: MainGunState, stats: MainGunStats, dt: number): MainGunState {
  const cooldown = Math.max(0, state.cooldown - dt);
  if (state.refill <= 0) return { ...state, cooldown };
  const refill = state.refill - dt;
  if (refill > 0) return { ...state, cooldown, refill };
  return { rounds: stats.quickRounds, cooldown, refill: 0 };
}

export function canFire(state: MainGunState): boolean {
  return state.rounds > 0 && state.cooldown <= 0 && state.refill <= 0;
}

export function tryFire(
  state: MainGunState,
  stats: MainGunStats,
): { state: MainGunState; fired: boolean } {
  if (!canFire(state)) return { state, fired: false };
  const rounds = state.rounds - 1;
  const refill = rounds === 0 ? stats.quickRounds * stats.refillPerRound : 0;
  return { state: { rounds, cooldown: stats.cooldown, refill }, fired: true };
}

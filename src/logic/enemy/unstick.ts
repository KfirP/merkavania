import { STUCK_RECOVER_TIME, STUCK_SPEED, STUCK_TIME } from '../../data/enemies';

/**
 * Gets enemy vehicles off walls. The brain steers straight at its goal, so a wall in the way
 * would pin a vehicle forever; after trying to move without getting anywhere, it reverses while
 * turning for a moment, then the brain steers again. Each time it turns the other way, so it
 * tries both ways round an obstacle.
 */
export interface UnstickState {
  /** Seconds spent trying to move while barely moving. */
  stuck: number;
  /** Seconds of reversing left. */
  recover: number;
  /** Turn direction of the current or next recovery, ±1. */
  turn: number;
}

export function initialUnstick(): UnstickState {
  return { stuck: 0, recover: 0, turn: 1 };
}

export function stepUnstick(
  state: UnstickState,
  wantsToMove: boolean,
  speed: number,
  dt: number,
): { state: UnstickState; override: { throttle: number; turn: number } | null } {
  if (state.recover > 0) {
    const recover = state.recover - dt;
    if (recover > 0)
      return { state: { ...state, recover }, override: { throttle: -1, turn: state.turn } };
    return { state: { stuck: 0, recover: 0, turn: -state.turn }, override: null };
  }
  const stuck = wantsToMove && Math.abs(speed) < STUCK_SPEED ? state.stuck + dt : 0;
  if (stuck < STUCK_TIME) return { state: { ...state, stuck }, override: null };
  return {
    state: { stuck: 0, recover: STUCK_RECOVER_TIME, turn: state.turn },
    override: { throttle: -1, turn: state.turn },
  };
}

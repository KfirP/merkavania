import { CRUSH_SPEED } from '../../data/combat';
import type { EnemyBehaviour } from '../../data/enemies';

/** Whether the tank, moving at `tankSpeed` px/s, runs over an enemy that fights this way. */
export function crushes(behaviour: EnemyBehaviour, tankSpeed: number): boolean {
  const onFoot = behaviour === 'infantry' || behaviour === 'missile_team';
  return onFoot && Math.abs(tankSpeed) >= CRUSH_SPEED;
}

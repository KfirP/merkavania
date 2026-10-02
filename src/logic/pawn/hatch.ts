import { offsetFrom } from '../tank/geometry';

/**
 * The rear hatch (docs/ARCHITECTURE.md, Pawns): deploys the scout behind the tank, and brings it
 * back when it walks into the tank, when it's recalled (it walks itself home) or when it goes down.
 */

export type HatchMode = 'tank' | 'scout' | 'recall';

export interface HatchState {
  mode: HatchMode;
  /** The scout has walked clear of the tank since it climbed out, so walking back boards it. */
  armed: boolean;
  /** Seconds before the hatch opens again (after the scout went down). */
  cooldown: number;
}

export const initialHatch = (): HatchState => ({ mode: 'tank', armed: false, cooldown: 0 });

/** Where the scout climbs out: just behind the hull, clear of both bodies. */
export function deployPoint(
  tank: { x: number; y: number },
  heading: number,
  tankRadius: number,
  scoutRadius: number,
): { x: number; y: number } {
  return offsetFrom(tank.x, tank.y, heading, -(tankRadius + scoutRadius + 2), 0);
}

export interface DeployCheck {
  has: boolean;
  alive: boolean;
  /** Hull speed, px/s (negative when reversing). */
  speed: number;
  maxSpeed: number;
  cooldown: number;
  /** The deploy point is on the tank's level and the scout may stand there. */
  spotOk: boolean;
}

export type DeployRefusal = 'locked' | 'dead' | 'moving' | 'cooldown' | 'blocked';

/** Why the hatch stays shut, or null when the scout may climb out. */
export function deployRefusal(c: DeployCheck): DeployRefusal | null {
  if (!c.has) return 'locked';
  if (!c.alive) return 'dead';
  if (Math.abs(c.speed) >= c.maxSpeed) return 'moving';
  if (c.cooldown > 0) return 'cooldown';
  if (!c.spotOk) return 'blocked';
  return null;
}

export interface HatchInput {
  /** Hatch pressed this frame. */
  hatch: boolean;
  canDeploy: boolean;
  tankAlive: boolean;
  scoutAlive: boolean;
  /** Scout centre to tank centre, px. */
  distToTank: number;
  boardRadius: number;
  deathCooldown: number;
  dt: number;
}

/** What the game should do this frame. */
export type HatchAction = 'none' | 'deploy' | 'refused' | 'recall' | 'board' | 'lost';

/** The scout is back inside; any cooldown keeps running. */
export function board(s: HatchState): HatchState {
  return { mode: 'tank', armed: false, cooldown: s.cooldown };
}

export function stepHatch(
  s: HatchState,
  i: HatchInput,
): { state: HatchState; action: HatchAction } {
  const cooldown = Math.max(0, s.cooldown - i.dt);
  if (s.mode === 'tank') {
    if (!i.hatch) return { state: { ...s, cooldown }, action: 'none' };
    if (!i.canDeploy) return { state: { ...s, cooldown }, action: 'refused' };
    return { state: { mode: 'scout', armed: false, cooldown }, action: 'deploy' };
  }
  if (!i.tankAlive) return { state: { mode: 'tank', armed: false, cooldown }, action: 'lost' };
  if (!i.scoutAlive)
    return { state: { mode: 'tank', armed: false, cooldown: i.deathCooldown }, action: 'lost' };

  const near = i.distToTank <= i.boardRadius;
  if (s.mode === 'recall')
    return near
      ? { state: board({ ...s, cooldown }), action: 'board' }
      : { state: { ...s, cooldown }, action: 'none' };

  if (s.armed && near) return { state: board({ ...s, cooldown }), action: 'board' };
  const armed = s.armed || !near;
  if (i.hatch) return { state: { mode: 'recall', armed, cooldown }, action: 'recall' };
  return { state: { mode: 'scout', armed, cooldown }, action: 'none' };
}

import {
  AIM_TOLERANCE,
  APPROACH_SHARE,
  FLEE_STEP,
  ORBIT_LEAD,
  ORBIT_SHARE,
  PANIC_DISTANCE,
  SEARCH_TIME,
  WAYPOINT_REACHED,
  type EnemyBehaviour,
} from '../../data/enemies';
import type { Vec2 } from '../input/stick';

/**
 * Enemy decision-making, one step at a time. `idle` (patrol or go home) → `alert` (spotted the
 * player: aim for `windup` seconds, the telegraph) → `engage` (fight per behaviour) → `search`
 * (lost sight: hunt the last known spot) → back to `idle`. Pure; the entity feeds it what it
 * perceives and carries out the intent.
 */

export type BrainMode = 'idle' | 'alert' | 'engage' | 'search';

export interface BrainDef {
  behaviour: EnemyBehaviour;
  fireRange: number;
  windup: number;
  /** Seconds between shots (the weapon's interval). */
  interval: number;
}

export interface BrainState {
  mode: BrainMode;
  /** Windup in `alert`, time left in `search`. */
  timer: number;
  /** Seconds until the weapon can fire again. */
  cooldown: number;
  /** Patrol waypoint being walked to. */
  waypoint: number;
  lastSeen: Vec2 | null;
}

export interface Perception {
  self: Vec2;
  /** Spawn point, where an idle enemy without a patrol returns. */
  home: Vec2;
  /** The player, or null while it's dead. */
  target: Vec2 | null;
  /** The player is on this level, within sight range and in line of sight. */
  visible: boolean;
  /** Angle between the current aim and the player, radians. */
  aimError: number;
  patrol?: readonly Vec2[];
}

export interface Intent {
  /** Where to move; null = stay put. */
  moveTo: Vec2 | null;
  /** What to aim at; null = keep the current aim. */
  aimAt: Vec2 | null;
  fire: boolean;
}

export function initialBrain(): BrainState {
  return { mode: 'idle', timer: 0, cooldown: 0, waypoint: 0, lastSeen: null };
}

const EPS = 1e-9;
const dist = (a: Vec2, b: Vec2) => Math.hypot(b.x - a.x, b.y - a.y);

export function stepBrain(
  prev: BrainState,
  p: Perception,
  def: BrainDef,
  dt: number,
): { state: BrainState; intent: Intent } {
  const state: BrainState = { ...prev, cooldown: Math.max(0, prev.cooldown - dt) };
  const target = p.target;

  if (!target) return idle({ ...state, mode: 'idle', lastSeen: null }, p, def);
  if (p.visible) state.lastSeen = { ...target };

  switch (state.mode) {
    case 'idle':
      if (!p.visible) return idle(state, p, def);
      state.mode = 'alert';
      state.timer = def.windup;
      return { state, intent: { moveTo: null, aimAt: target, fire: false } };

    case 'alert':
      if (!p.visible) return search(state, def, true);
      state.timer -= dt;
      if (state.timer > EPS) return { state, intent: { moveTo: null, aimAt: target, fire: false } };
      state.mode = 'engage';
      return engage(state, p, target, def);

    case 'engage':
      if (!p.visible) return search(state, def, true);
      return engage(state, p, target, def);

    case 'search':
      if (p.visible) {
        state.mode = 'engage';
        return engage(state, p, target, def);
      }
      return search(state, def, false, dt);
  }
}

function idle(state: BrainState, p: Perception, def: BrainDef) {
  const intent: Intent = { moveTo: null, aimAt: null, fire: false };
  if (def.behaviour === 'static') return { state, intent };
  const patrol = p.patrol;
  if (patrol && patrol.length > 0) {
    let i = state.waypoint % patrol.length;
    if (dist(p.self, patrol[i]!) <= WAYPOINT_REACHED) i = (i + 1) % patrol.length;
    state.waypoint = i;
    intent.moveTo = patrol[i]!;
  } else if (dist(p.self, p.home) > WAYPOINT_REACHED) intent.moveTo = p.home;
  return { state, intent };
}

function search(state: BrainState, def: BrainDef, entering: boolean, dt = 0) {
  if (entering) {
    state.mode = 'search';
    state.timer = SEARCH_TIME;
  } else state.timer -= dt;
  if (state.timer <= EPS) {
    state.mode = 'idle';
    state.lastSeen = null;
    return { state, intent: { moveTo: null, aimAt: null, fire: false } };
  }
  const spot = state.lastSeen;
  const moveTo = def.behaviour === 'static' ? null : spot;
  return { state, intent: { moveTo, aimAt: spot, fire: false } };
}

function engage(state: BrainState, p: Perception, target: Vec2, def: BrainDef) {
  const d = dist(p.self, target);
  const fire = d <= def.fireRange && p.aimError <= AIM_TOLERANCE && state.cooldown <= EPS;
  if (fire) state.cooldown = def.interval;
  return { state, intent: { moveTo: engageMove(p.self, target, d, def), aimAt: target, fire } };
}

function engageMove(self: Vec2, target: Vec2, d: number, def: BrainDef): Vec2 | null {
  switch (def.behaviour) {
    case 'static':
      return null;
    case 'infantry':
    case 'missile_team': {
      if (d >= PANIC_DISTANCE || d === 0) return null;
      const k = FLEE_STEP / d;
      return { x: self.x + (self.x - target.x) * k, y: self.y + (self.y - target.y) * k };
    }
    case 'armor':
      return d > def.fireRange * APPROACH_SHARE ? { ...target } : null;
    case 'raider': {
      const r = def.fireRange * ORBIT_SHARE;
      const a = Math.atan2(self.y - target.y, self.x - target.x) + ORBIT_LEAD;
      return { x: target.x + Math.cos(a) * r, y: target.y + Math.sin(a) * r };
    }
  }
}

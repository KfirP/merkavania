import type { BossDef } from '../../data/bosses';
import { wrapAngle } from '../input/stick';

/**
 * A boss's brain (data/bosses.ts): `dormant` until the player enters its arena, a short `intro`
 * (camera pan, radio), then `fight` until it's `dead`. In the fight the gun slides along its rail
 * toward the target, turns to aim, and fires on a cycle whose last `telegraph` seconds show a
 * warning laser. Below `phase2.at` HP it fires faster and calls reinforcements. Pure: the Boss
 * entity feeds it and carries out the intent.
 */

export type BossMode = 'dormant' | 'intro' | 'fight' | 'dead';
type Point = { x: number; y: number };

export interface BossState {
  mode: BossMode;
  /** Seconds in the current mode. */
  t: number;
  /** Distance of the gun along the rail, px. */
  railPos: number;
  /** Gun aim, radians. */
  aim: number;
  /** Seconds to the next shot. */
  cooldown: number;
  /** The warning laser is up (the next shot is near). */
  telegraphing: boolean;
  phase: 1 | 2;
  /** Seconds to the next reinforcement call (phase 2). */
  reinforce: number;
}

export interface BossInput {
  /** HP left as a share of max. */
  hpShare: number;
  /** Where to shoot (the player), or null with nobody to shoot at. */
  target: Point | null;
  /** The player is in the arena. */
  inArena: boolean;
  /** Reinforcements still alive. */
  reinforcementsAlive: number;
}

export interface BossIntent {
  fire: boolean;
  spawn: boolean;
  /** Just woke up: start the intro (camera, radio). */
  woke: boolean;
  enteredPhase2: boolean;
}

// --- Rail geometry ---

const segLength = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

export function railLength(rail: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < rail.length; i++) total += segLength(rail[i - 1]!, rail[i]!);
  return total;
}

/** The point `s` px along the rail, clamped to its ends. */
export function railPoint(rail: readonly Point[], s: number): Point {
  let left = Math.max(0, s);
  for (let i = 1; i < rail.length; i++) {
    const a = rail[i - 1]!;
    const b = rail[i]!;
    const len = segLength(a, b);
    if (left <= len) {
      const k = len === 0 ? 0 : left / len;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    left -= len;
  }
  const last = rail[rail.length - 1]!;
  return { x: last.x, y: last.y };
}

/** Distance along the rail of its closest point to `p`. */
export function projectOnRail(rail: readonly Point[], p: Point): number {
  let best = 0;
  let bestDist = Infinity;
  let start = 0;
  for (let i = 1; i < rail.length; i++) {
    const a = rail[i - 1]!;
    const b = rail[i]!;
    const len = segLength(a, b);
    const along =
      len === 0 ? 0 : ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len ** 2;
    const k = Math.max(0, Math.min(1, along));
    const q = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < bestDist) {
      bestDist = d;
      best = start + k * len;
    }
    start += len;
  }
  return best;
}

// --- Brain ---

/** A sleeping boss with its gun in the middle of the rail, aiming south. */
export function initialBoss(rail: readonly Point[]): BossState {
  return {
    mode: 'dormant',
    t: 0,
    railPos: railLength(rail) / 2,
    aim: Math.PI / 2,
    cooldown: 0,
    telegraphing: false,
    phase: 1,
    reinforce: 0,
  };
}

export function stepBoss(
  s: BossState,
  def: BossDef,
  rail: readonly Point[],
  input: BossInput,
  dt: number,
): BossIntent {
  const intent: BossIntent = { fire: false, spawn: false, woke: false, enteredPhase2: false };
  s.t += dt;
  switch (s.mode) {
    case 'dead':
      s.telegraphing = false;
      return intent;
    case 'dormant':
      if (input.inArena) {
        s.mode = 'intro';
        s.t = 0;
        intent.woke = true;
      }
      return intent;
    case 'intro':
      if (s.t >= def.intro) {
        s.mode = 'fight';
        s.t = 0;
        // The first shot comes after a full warning.
        s.cooldown = def.gun.telegraph;
        s.reinforce = def.phase2.reinforcements.every;
      }
      return intent;
    case 'fight':
      break;
  }

  if (s.phase === 1 && input.hpShare <= def.phase2.at) {
    s.phase = 2;
    intent.enteredPhase2 = true;
  }

  const target = input.target;
  if (target) {
    // Slide toward the spot on the rail nearest the target.
    const want = projectOnRail(rail, target);
    const step = def.gun.railSpeed * dt;
    s.railPos += Math.max(-step, Math.min(step, want - s.railPos));
    const gun = railPoint(rail, s.railPos);
    const desired = Math.atan2(target.y - gun.y, target.x - gun.x);
    const turn = def.gun.traverseRate * dt;
    s.aim = wrapAngle(s.aim + Math.max(-turn, Math.min(turn, wrapAngle(desired - s.aim))));

    s.cooldown -= dt;
    s.telegraphing = s.cooldown <= def.gun.telegraph;
    if (s.cooldown <= 0) {
      intent.fire = true;
      s.cooldown = def.gun.interval * (s.phase === 2 ? def.phase2.intervalMul : 1);
      s.telegraphing = false;
    }
  } else {
    // Nobody to shoot at: the next shot starts with a full warning again.
    s.cooldown = Math.max(s.cooldown, def.gun.telegraph);
    s.telegraphing = false;
  }

  if (s.phase === 2) {
    s.reinforce -= dt;
    const { every, max } = def.phase2.reinforcements;
    if (s.reinforce <= 0) {
      s.reinforce = every;
      if (input.reinforcementsAlive < max) intent.spawn = true;
    }
  }
  return intent;
}

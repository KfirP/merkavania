import type Phaser from 'phaser';
import { events, type CombatHit, type PawnTelemetry, type WorldState } from './events';

export function isDebug(): boolean {
  return import.meta.env.DEV || new URLSearchParams(window.location.search).get('debug') === '1';
}

/** Hits kept for `getCombatLog`. */
const COMBAT_LOG_SIZE = 100;

export interface DebugHooks {
  game: Phaser.Game;
  /** The active pawn as of the last frame, or null before WorldScene runs. */
  getPawn(): PawnTelemetry | null;
  /** Shots fired per weapon id since boot. */
  getShots(): Record<string, number>;
  /** Current and loaded chunks, or null before WorldScene streams any. */
  getWorld(): WorldState | null;
  /** Moves the active pawn to world (x, y) and stops it, optionally facing `heading` (radians). */
  teleport(x: number, y: number, heading?: number): void;
  /** Deals `amount` damage to the player, ignoring armor. */
  damagePlayer(amount: number): void;
  /** The player takes no damage while on. */
  setGod(on: boolean): void;
  /** The most recent resolved hits, oldest first. */
  getCombatLog(): CombatHit[];
}

declare global {
  interface Window {
    __merkavania?: DebugHooks;
  }
}

/** Exposes hooks for Playwright and the console. Debug builds only. */
export function installDebugHooks(game: Phaser.Game): void {
  if (!isDebug()) return;
  let pawn: PawnTelemetry | null = null;
  let world: WorldState | null = null;
  const shots: Record<string, number> = {};
  const hits: CombatHit[] = [];
  events.on('debug:pawn', (p) => (pawn = p));
  events.on('world:chunks', (w) => (world = w));
  events.on('weapon:fired', ({ weapon }) => (shots[weapon] = (shots[weapon] ?? 0) + 1));
  events.on('combat:hit', (hit) => {
    hits.push(hit);
    if (hits.length > COMBAT_LOG_SIZE) hits.shift();
  });
  window.__merkavania = {
    game,
    getPawn: () => pawn,
    getShots: () => ({ ...shots }),
    getWorld: () => world && { chunk: world.chunk, loaded: [...world.loaded] },
    teleport: (x, y, heading) => events.emit('debug:teleport', { x, y, heading }),
    damagePlayer: (amount) => events.emit('debug:damagePlayer', { amount }),
    setGod: (on) => events.emit('debug:god', { on }),
    getCombatLog: () => hits.map((h) => ({ ...h })),
  };
}

import type Phaser from 'phaser';
import { events, type PawnTelemetry } from './events';

export function isDebug(): boolean {
  return import.meta.env.DEV || new URLSearchParams(window.location.search).get('debug') === '1';
}

export interface DebugHooks {
  game: Phaser.Game;
  /** The active pawn as of the last frame, or null before WorldScene runs. */
  getPawn(): PawnTelemetry | null;
  /** Shots fired per weapon id since boot. */
  getShots(): Record<string, number>;
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
  const shots: Record<string, number> = {};
  events.on('debug:pawn', (p) => (pawn = p));
  events.on('weapon:fired', ({ weapon }) => (shots[weapon] = (shots[weapon] ?? 0) + 1));
  window.__merkavania = { game, getPawn: () => pawn, getShots: () => ({ ...shots }) };
}

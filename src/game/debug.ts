import type Phaser from 'phaser';

export function isDebug(): boolean {
  return import.meta.env.DEV || new URLSearchParams(window.location.search).get('debug') === '1';
}

export interface DebugHooks {
  game: Phaser.Game;
}

declare global {
  interface Window {
    __merkavania?: DebugHooks;
  }
}

/** Exposes hooks for Playwright and the console. Debug builds only. */
export function installDebugHooks(game: Phaser.Game): void {
  if (!isDebug()) return;
  window.__merkavania = { game };
}

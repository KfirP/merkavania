/**
 * Shared virtual-stick state: TouchControlsScene writes it, TouchAdapter reads it. A plain store
 * keeps the two scenes decoupled (neither holds the other's game objects).
 */
export interface StickState {
  /** -1..1, already clamped to the unit circle; y points down. */
  x: number;
  y: number;
  active: boolean;
}

export const touchState = {
  left: { x: 0, y: 0, active: false } as StickState,
  right: { x: 0, y: 0, active: false } as StickState,
  altFire: false,
  /** performance.now() of the last touch, used to ignore browser-emulated mouse events. */
  lastTouchAt: -Infinity,
};

export function recentlyTouched(now = performance.now()): boolean {
  return now - touchState.lastTouchAt < 1000;
}

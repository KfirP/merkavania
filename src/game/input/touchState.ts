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

export interface LobTouch {
  active: boolean;
  overButton: boolean;
  x: number;
  y: number;
}

export const touchState = {
  left: { x: 0, y: 0, active: false } as StickState,
  right: { x: 0, y: 0, active: false } as StickState,
  /** MG mode (ALT toggle): the right stick's outer ring fires the coax. */
  mgOn: false,
  /**
   * Mortar button: a finger that started on it, where it is now (game px, screen space) and
   * whether it's back over the button. `x`/`y` keep the last spot after the lift.
   */
  lob: { active: false, overButton: false, x: 0, y: 0 } as LobTouch,
  /** The hatch button was tapped; TouchAdapter takes it as one `cmd.hatch` press. */
  hatchTapped: false,
  /** performance.now() of the last touch, used to ignore browser-emulated mouse events. */
  lastTouchAt: -Infinity,
};

export function recentlyTouched(now = performance.now()): boolean {
  return now - touchState.lastTouchAt < 1000;
}

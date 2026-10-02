/**
 * Touch mortar button (docs/GAME_DESIGN.md controls): press the button, drag to the spot and lift
 * to fire there. A tap fires nothing, and dragging back onto the button cancels.
 */

export interface TouchLobState {
  wasActive: boolean;
  /** The finger has left the button: lifting now fires. */
  armed: boolean;
}

export interface TouchLobInput {
  /** A finger that started on the button is still down. */
  active: boolean;
  /** That finger is over the button. */
  overButton: boolean;
}

export function initialTouchLob(): TouchLobState {
  return { wasActive: false, armed: false };
}

export function stepTouchLob(
  state: TouchLobState,
  input: TouchLobInput,
): { state: TouchLobState; fire: boolean } {
  if (input.active) return { state: { wasActive: true, armed: !input.overButton }, fire: false };
  return { state: initialTouchLob(), fire: state.wasActive && state.armed };
}

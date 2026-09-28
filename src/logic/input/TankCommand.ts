/** Device-independent input for the active pawn, produced once per frame by the input adapters. */
export interface TankCommand {
  /** -1..1 */
  throttle: number;
  /** -1..1, hull rotation */
  turn: number;
  /** World-space radians; null keeps the current aim. */
  aimAngle: number | null;
  fire: boolean;
  altFire: boolean;
  cycleNext: boolean;
  cyclePrev: boolean;
  hatch: boolean;
  interact: boolean;
  map: boolean;
  pause: boolean;
}

export function emptyCommand(): TankCommand {
  return {
    throttle: 0,
    turn: 0,
    aimAngle: null,
    fire: false,
    altFire: false,
    cycleNext: false,
    cyclePrev: false,
    hatch: false,
    interact: false,
    map: false,
    pause: false,
  };
}

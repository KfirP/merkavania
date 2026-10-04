/** Device-independent input for the active pawn, produced once per frame by the input adapters. */
export interface TankCommand {
  /** -1..1 */
  throttle: number;
  /** -1..1, hull rotation */
  turn: number;
  /** World-space radians; null keeps the current aim. */
  aimAngle: number | null;
  /** Px from the pawn to the aimed spot (mouse, gamepad tilt) for the mortar; null keeps it. */
  aimDistance: number | null;
  /** One-shot mortar fire at a spot (touch mortar button), regardless of the selected secondary. */
  lob: { angle: number; distance: number } | null;
  fire: boolean;
  altFire: boolean;
  /** Alt fire means the coax whatever secondary is selected (touch MG mode). */
  altCoax: boolean;
  cycleNext: boolean;
  cyclePrev: boolean;
  hatch: boolean;
  /** Spend a repair kit charge. */
  repair: boolean;
  interact: boolean;
  map: boolean;
  pause: boolean;
}

export function emptyCommand(): TankCommand {
  return {
    throttle: 0,
    turn: 0,
    aimAngle: null,
    aimDistance: null,
    lob: null,
    fire: false,
    altFire: false,
    altCoax: false,
    cycleNext: false,
    cyclePrev: false,
    hatch: false,
    repair: false,
    interact: false,
    map: false,
    pause: false,
  };
}

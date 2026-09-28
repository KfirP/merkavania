import type { TankCommand } from '../../logic/input/TankCommand';

/** What adapters may need about the active pawn this frame. */
export interface InputContext {
  /** Pawn world position (mouse aim is measured from here). */
  x: number;
  y: number;
  /** Current turret angle (touch fires a released shot once it lines up). */
  turretAngle: number;
  /** Seconds since the last poll. */
  dt: number;
}

export interface InputAdapter {
  /**
   * Fills `cmd` from this device. Returns true when the player touched the device this frame,
   * which makes it the active device.
   */
  poll(cmd: TankCommand, ctx: InputContext): boolean;
  destroy(): void;
}

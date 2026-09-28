import type { TankCommand } from '../../logic/input/TankCommand';

export interface AimOrigin {
  x: number;
  y: number;
}

export interface InputAdapter {
  /**
   * Fills `cmd` from this device. Returns true when the player touched the device this frame,
   * which makes it the active device.
   */
  poll(cmd: TankCommand, origin: AimOrigin): boolean;
  destroy(): void;
}

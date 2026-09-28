import { touchAnalog } from '../../logic/input/mapping';
import type { TankCommand } from '../../logic/input/TankCommand';
import type { InputAdapter } from './InputAdapter';
import { touchState } from './touchState';

/** Reads the virtual sticks drawn by TouchControlsScene. */
export class TouchAdapter implements InputAdapter {
  poll(cmd: TankCommand): boolean {
    const { left, right } = touchState;
    Object.assign(cmd, touchAnalog(left, right));
    cmd.altFire = touchState.altFire;
    return left.active || right.active || touchState.altFire;
  }

  destroy(): void {}
}

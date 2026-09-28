import type Phaser from 'phaser';
import { INPUT_DEVICES, selectDevice, type InputDevice } from '../../logic/input/device';
import { emptyCommand, type TankCommand } from '../../logic/input/TankCommand';
import { GamepadAdapter } from '../input/GamepadAdapter';
import type { InputAdapter, InputContext } from '../input/InputAdapter';
import { KeyboardMouseAdapter } from '../input/KeyboardMouseAdapter';
import { TouchAdapter } from '../input/TouchAdapter';

/**
 * Polls every device once per frame and hands the active pawn one TankCommand. The command comes
 * from the most recently used device, so an idle mouse can't override the gamepad's aim.
 */
export class InputSystem {
  private readonly adapters: Record<InputDevice, InputAdapter>;
  private readonly scratch: Record<InputDevice, TankCommand> = {
    keyboardMouse: emptyCommand(),
    gamepad: emptyCommand(),
    touch: emptyCommand(),
  };
  active: InputDevice = 'keyboardMouse';

  constructor(scene: Phaser.Scene) {
    this.adapters = {
      keyboardMouse: new KeyboardMouseAdapter(scene),
      gamepad: new GamepadAdapter(scene),
      touch: new TouchAdapter(),
    };
  }

  /** Polls all devices; every adapter is polled each frame so its edge detection stays current. */
  update(ctx: InputContext): TankCommand {
    const used = { keyboardMouse: false, gamepad: false, touch: false };
    for (const device of INPUT_DEVICES) {
      const cmd = this.scratch[device];
      Object.assign(cmd, emptyCommand());
      used[device] = this.adapters[device].poll(cmd, ctx);
    }
    this.active = selectDevice(this.active, used);
    return this.scratch[this.active];
  }

  destroy(): void {
    for (const adapter of Object.values(this.adapters)) adapter.destroy();
  }
}

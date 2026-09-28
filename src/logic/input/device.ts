export type InputDevice = 'keyboardMouse' | 'gamepad' | 'touch';

export const INPUT_DEVICES: readonly InputDevice[] = ['keyboardMouse', 'gamepad', 'touch'];

/**
 * The device whose command drives the pawn: the one the player used most recently, so an idle
 * mouse can't override the gamepad's aim. With several used in one frame, the current one stays.
 */
export function selectDevice(
  current: InputDevice,
  usedThisFrame: Record<InputDevice, boolean>,
): InputDevice {
  if (usedThisFrame[current]) return current;
  return INPUT_DEVICES.find((d) => usedThisFrame[d]) ?? current;
}

/**
 * A thumb drag from the stick's base: `x`/`y` is the stick value (unit circle, y down) and
 * `knobX`/`knobY` the knob's offset in px, clamped to the rim.
 */
export function dragToStick(
  dx: number,
  dy: number,
  radius: number,
): { x: number; y: number; knobX: number; knobY: number } {
  const dist = Math.hypot(dx, dy);
  const k = dist > radius ? radius / dist : 1;
  const knobX = dx * k;
  const knobY = dy * k;
  return { x: knobX / radius, y: knobY / radius, knobX, knobY };
}

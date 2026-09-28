/**
 * A point `forward` px along `angle` and `left` px to its left (screen space, y down), e.g. the
 * turret pivot on the hull or the coax MG beside the barrel.
 */
export function offsetFrom(
  x: number,
  y: number,
  angle: number,
  forward: number,
  left: number,
): { x: number; y: number } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: x + cos * forward + sin * left, y: y + sin * forward - cos * left };
}

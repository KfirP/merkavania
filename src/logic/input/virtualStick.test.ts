import { describe, expect, it } from 'vitest';
import { dragToStick } from './virtualStick';

describe('dragToStick', () => {
  it('scales a drag inside the radius to -1..1', () => {
    const s = dragToStick(14, 0, 28);
    expect(s.x).toBeCloseTo(0.5);
    expect(s.y).toBe(0);
    expect(s.knobX).toBe(14);
  });

  it('clamps drags past the radius to the rim, keeping the direction', () => {
    const s = dragToStick(0, -100, 28);
    expect(s.y).toBeCloseTo(-1);
    expect(s.knobY).toBeCloseTo(-28);
    expect(Math.hypot(s.x, s.y)).toBeCloseTo(1);
  });

  it('is zero when not dragged', () => {
    expect(dragToStick(0, 0, 28)).toEqual({ x: 0, y: 0, knobX: 0, knobY: 0 });
  });
});

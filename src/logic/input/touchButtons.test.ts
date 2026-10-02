import { describe, expect, it } from 'vitest';
import { GAME_HEIGHT, GAME_WIDTH } from '../scale';
import { hudLayout, MINIMAP_CELL } from '../ui/hudLayout';
import { hitTouchButton, TOUCH_BUTTONS, TOUCH_SLOP, touchButtonIds } from './touchButtons';

const all = () => true;

describe('TOUCH_BUTTONS', () => {
  it('keeps every button on screen and apart from the others', () => {
    for (const id of touchButtonIds) {
      const b = TOUCH_BUTTONS[id];
      expect(b.x - b.r, id).toBeGreaterThanOrEqual(0);
      expect(b.y - b.r, id).toBeGreaterThanOrEqual(0);
      expect(b.x + b.r, id).toBeLessThanOrEqual(GAME_WIDTH);
      expect(b.y + b.r, id).toBeLessThanOrEqual(GAME_HEIGHT);
      for (const other of touchButtonIds) {
        if (other === id) continue;
        const o = TOUCH_BUTTONS[other];
        expect(Math.hypot(b.x - o.x, b.y - o.y), `${id}/${other}`).toBeGreaterThan(
          b.r + o.r + 2 * TOUCH_SLOP,
        );
      }
    }
  });

  it('keeps the top buttons clear of the minimap in either reading direction', () => {
    for (const rtl of [false, true]) {
      const m = hudLayout(rtl).minimap;
      const w = 3 * MINIMAP_CELL.w;
      const left = m.originX === 1 ? m.x - w : m.x;
      const bottom = m.y + 3 * MINIMAP_CELL.h;
      for (const id of ['pause', 'map'] as const) {
        const b = TOUCH_BUTTONS[id];
        const clearX = b.x + b.r < left || b.x - b.r > left + w;
        expect(clearX || b.y - b.r > bottom, `${id} rtl=${rtl}`).toBe(true);
      }
    }
  });
});

describe('hitTouchButton', () => {
  it('finds the button under a touch, with a little slop', () => {
    const p = TOUCH_BUTTONS.pause;
    expect(hitTouchButton(p.x, p.y, all)).toBe('pause');
    expect(hitTouchButton(p.x + p.r + TOUCH_SLOP, p.y, all)).toBe('pause');
    expect(hitTouchButton(p.x + p.r + TOUCH_SLOP + 1, p.y, all)).toBeNull();
  });

  it('ignores hidden buttons', () => {
    const s = TOUCH_BUTTONS.swap;
    expect(hitTouchButton(s.x, s.y, (id) => id !== 'swap')).toBeNull();
  });

  it('is null away from every button', () => {
    expect(hitTouchButton(GAME_WIDTH / 2, GAME_HEIGHT / 2, all)).toBeNull();
  });
});

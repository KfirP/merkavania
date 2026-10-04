import { describe, expect, it } from 'vitest';
import { GAME_HEIGHT, GAME_WIDTH } from '../scale';
import { HUD_ELEMENTS, hudLayout, MINIMAP_CELL, mirrorX } from './hudLayout';

describe('hudLayout', () => {
  it('keeps every element on screen', () => {
    for (const rtl of [false, true]) {
      const l = hudLayout(rtl);
      for (const id of HUD_ELEMENTS) {
        expect(l[id].x, id).toBeGreaterThanOrEqual(0);
        expect(l[id].x, id).toBeLessThanOrEqual(GAME_WIDTH);
        expect(l[id].y, id).toBeGreaterThanOrEqual(0);
        expect(l[id].y, id).toBeLessThanOrEqual(GAME_HEIGHT);
      }
    }
  });

  it('puts the status block bottom left and the minimap top right in English', () => {
    const l = hudLayout(false);
    expect(l.hpBar.x).toBeLessThan(GAME_WIDTH / 4);
    expect(l.hpBar.y).toBeGreaterThan(GAME_HEIGHT * 0.75);
    expect(l.minimap.x).toBeGreaterThan(GAME_WIDTH * 0.75);
    expect(l.minimap.y).toBeLessThan(GAME_HEIGHT / 4);
  });

  it('mirrors horizontally in RTL', () => {
    const ltr = hudLayout(false);
    const rtl = hudLayout(true);
    for (const id of HUD_ELEMENTS) {
      expect(rtl[id].x, id).toBe(GAME_WIDTH - ltr[id].x);
      expect(rtl[id].y, id).toBe(ltr[id].y);
      expect(rtl[id].originX, id).toBe(1 - ltr[id].originX);
      expect(rtl[id].dir, id).toBe(-ltr[id].dir);
    }
  });

  it('stacks the status rows without overlap', () => {
    const l = hudLayout(false);
    const rows = [l.tier.y, l.secondary.y, l.hpBar.y].sort((a, b) => a - b);
    for (let i = 1; i < rows.length; i++) expect(rows[i]! - rows[i - 1]!).toBeGreaterThanOrEqual(8);
  });

  it('leaves room for a 3×3 minimap', () => {
    const l = hudLayout(false);
    expect(l.minimap.x - 3 * MINIMAP_CELL.w).toBeGreaterThan(GAME_WIDTH / 2);
  });
});

describe('mirrorX', () => {
  it('flips a span about the screen centre in RTL only', () => {
    expect(mirrorX(10, 20, false)).toBe(10);
    expect(mirrorX(10, 20, true)).toBe(GAME_WIDTH - 30);
  });
});

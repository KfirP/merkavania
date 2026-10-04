import { describe, expect, it } from 'vitest';
import { firstFocus, menuInputFromCode, navigate, type MenuItem } from './menu';

const items: MenuItem[] = [
  { kind: 'action', id: 'resume' },
  { kind: 'action', id: 'locked', disabled: true },
  { kind: 'choice', id: 'lang', options: ['en', 'he'], value: 0 },
  { kind: 'slider', id: 'music', value: 0.5, step: 0.1 },
];

describe('firstFocus', () => {
  it('is the first enabled item, or -1 when there is none', () => {
    expect(firstFocus(items)).toBe(0);
    expect(firstFocus([{ kind: 'action', id: 'x', disabled: true }, ...items])).toBe(1);
    expect(firstFocus([{ kind: 'action', id: 'x', disabled: true }])).toBe(-1);
  });
});

describe('navigate', () => {
  it('moves down and up, skipping disabled items and wrapping', () => {
    expect(navigate(items, 0, 'down').focus).toBe(2);
    expect(navigate(items, 2, 'up').focus).toBe(0);
    expect(navigate(items, 3, 'down').focus).toBe(0);
    expect(navigate(items, 0, 'up').focus).toBe(3);
    expect(navigate(items, 0, 'down').event).toEqual({ type: 'focus' });
  });

  it('activates an action on confirm', () => {
    expect(navigate(items, 0, 'confirm')).toEqual({
      focus: 0,
      event: { type: 'activate', id: 'resume' },
    });
  });

  it('cycles a choice with left, right and confirm', () => {
    expect(navigate(items, 2, 'right').event).toEqual({ type: 'change', id: 'lang', value: 1 });
    expect(navigate(items, 2, 'confirm').event).toEqual({ type: 'change', id: 'lang', value: 1 });
    expect(navigate(items, 2, 'left').event).toEqual({ type: 'change', id: 'lang', value: 1 });
  });

  it('steps a slider within 0..1 without float drift', () => {
    expect(navigate(items, 3, 'right').event).toEqual({ type: 'change', id: 'music', value: 0.6 });
    expect(navigate(items, 3, 'left').event).toEqual({ type: 'change', id: 'music', value: 0.4 });
    const full: MenuItem[] = [{ kind: 'slider', id: 'v', value: 1, step: 0.1 }];
    expect(navigate(full, 0, 'right').event).toEqual({ type: 'none' });
    const almost: MenuItem[] = [{ kind: 'slider', id: 'v', value: 0.05, step: 0.1 }];
    expect(navigate(almost, 0, 'left').event).toEqual({ type: 'change', id: 'v', value: 0 });
  });

  it('ignores left and right on an action, and confirm on a slider', () => {
    expect(navigate(items, 0, 'left').event).toEqual({ type: 'none' });
    expect(navigate(items, 3, 'confirm').event).toEqual({ type: 'none' });
  });

  it('reports back whatever is focused', () => {
    expect(navigate(items, 2, 'back')).toEqual({ focus: 2, event: { type: 'back' } });
  });

  it('copes with an empty menu or a stale focus', () => {
    expect(navigate([], 0, 'down')).toEqual({ focus: -1, event: { type: 'none' } });
    expect(navigate(items, 9, 'confirm').focus).toBe(0);
  });
});

describe('menuInputFromCode', () => {
  it('maps arrows, WASD, Enter/Space and Esc/Backspace', () => {
    expect(menuInputFromCode('ArrowUp')).toBe('up');
    expect(menuInputFromCode('KeyS')).toBe('down');
    expect(menuInputFromCode('KeyA')).toBe('left');
    expect(menuInputFromCode('ArrowRight')).toBe('right');
    expect(menuInputFromCode('Enter')).toBe('confirm');
    expect(menuInputFromCode('NumpadEnter')).toBe('confirm');
    expect(menuInputFromCode('Space')).toBe('confirm');
    expect(menuInputFromCode('Escape')).toBe('back');
    expect(menuInputFromCode('Backspace')).toBe('back');
    expect(menuInputFromCode('KeyQ')).toBeNull();
  });
});

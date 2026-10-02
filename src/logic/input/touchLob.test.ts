import { describe, expect, it } from 'vitest';
import { initialTouchLob, stepTouchLob } from './touchLob';

describe('stepTouchLob', () => {
  const press = (overButton: boolean) => ({ active: true, overButton });
  const lift = { active: false, overButton: false };

  it('fires once when the drag lifts away from the button', () => {
    let s = initialTouchLob();
    let r = stepTouchLob(s, press(true));
    expect(r.fire).toBe(false);
    expect(r.state.armed).toBe(false);
    r = stepTouchLob(r.state, press(false));
    expect(r.fire).toBe(false);
    expect(r.state.armed).toBe(true);
    r = stepTouchLob(r.state, lift);
    expect(r.fire).toBe(true);
    s = r.state;
    expect(stepTouchLob(s, lift).fire).toBe(false);
  });

  it('a tap on the button never fires', () => {
    let r = stepTouchLob(initialTouchLob(), press(true));
    r = stepTouchLob(r.state, lift);
    expect(r.fire).toBe(false);
  });

  it('dragging back onto the button cancels', () => {
    let r = stepTouchLob(initialTouchLob(), press(true));
    r = stepTouchLob(r.state, press(false));
    r = stepTouchLob(r.state, press(true));
    expect(r.state.armed).toBe(false);
    r = stepTouchLob(r.state, lift);
    expect(r.fire).toBe(false);
  });
});

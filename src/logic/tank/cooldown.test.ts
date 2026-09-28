import { describe, expect, it } from 'vitest';
import { tickCooldown, tryTrigger } from './cooldown';

describe('cooldown', () => {
  it('fires, then waits the interval', () => {
    const a = tryTrigger(0, 0.1);
    expect(a).toEqual({ remaining: 0.1, fired: true });
    expect(tryTrigger(tickCooldown(a.remaining, 0.05), 0.1).fired).toBe(false);
    expect(tryTrigger(tickCooldown(a.remaining, 0.1), 0.1).fired).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { RisingEdge } from './edge';

describe('RisingEdge', () => {
  it('fires once per press', () => {
    const e = new RisingEdge();
    expect([false, true, true, false, true].map((d) => e.update(d))).toEqual([
      false,
      true,
      false,
      false,
      true,
    ]);
  });
});

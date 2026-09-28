import { describe, expect, it } from 'vitest';
import { WorldFlags } from './flags';

describe('WorldFlags', () => {
  it('remembers keys that were set', () => {
    const flags = new WorldFlags();
    expect(flags.has('test_x00_y01:bags1')).toBe(false);
    flags.set('test_x00_y01:bags1');
    expect(flags.has('test_x00_y01:bags1')).toBe(true);
    expect(flags.has('test_x00_y01:bags2')).toBe(false);
  });

  it('round-trips through a plain list (for saves in M4)', () => {
    const flags = new WorldFlags(['a:1']);
    flags.set('b:2');
    expect(new WorldFlags(flags.toJSON()).has('b:2')).toBe(true);
    expect(flags.toJSON().sort()).toEqual(['a:1', 'b:2']);
  });
});

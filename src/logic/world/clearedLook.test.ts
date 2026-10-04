import { describe, expect, it } from 'vitest';
import { clearedLook } from './clearedLook';

describe('clearedLook', () => {
  const rubble = { terrain: 'rubble', cleared: 7 };

  it('swaps a rubble tile for its cleared look once the tank has the dozer blade', () => {
    expect(clearedLook(rubble, ['dozer_blade'])).toBe(7);
  });

  it('keeps the rubble look without the blade', () => {
    expect(clearedLook(rubble, ['mortar'])).toBeNull();
  });

  it('ignores tiles without a cleared look, or whose terrain has no ability gate', () => {
    expect(clearedLook({ terrain: 'rubble' }, ['dozer_blade'])).toBeNull();
    expect(clearedLook({ terrain: 'sand', cleared: 3 }, ['dozer_blade'])).toBeNull();
  });
});

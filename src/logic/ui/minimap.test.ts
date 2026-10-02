import { describe, expect, it } from 'vitest';
import { minimapCells } from './minimap';

const chunks = [
  { id: 'a', cx: 0, cy: 0 },
  { id: 'b', cx: 1, cy: 0 },
  { id: 'c', cx: 2, cy: 0 },
  { id: 'd', cx: 1, cy: 1 },
];

describe('minimapCells', () => {
  it('is a 3×3 grid around the current chunk, row by row', () => {
    const cells = minimapCells(chunks, ['a', 'b'], 'b');
    expect(cells).toEqual([
      ['none', 'none', 'none'],
      ['visited', 'current', 'unknown'],
      ['none', 'unknown', 'none'],
    ]);
  });

  it('is empty-but-centred when the current chunk is unknown', () => {
    const cells = minimapCells(chunks, [], 'zzz');
    expect(cells.flat().every((c) => c === 'none')).toBe(true);
    expect(cells).toHaveLength(3);
  });
});

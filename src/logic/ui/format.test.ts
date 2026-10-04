import { describe, expect, it } from 'vitest';
import { formatDate, formatPercent, formatPlaytime } from './format';

describe('formatPlaytime', () => {
  it('shows m:ss under an hour and h:mm:ss after', () => {
    expect(formatPlaytime(0)).toBe('0:00');
    expect(formatPlaytime(65_000)).toBe('1:05');
    expect(formatPlaytime(59 * 60_000 + 59_999)).toBe('59:59');
    expect(formatPlaytime(3_600_000 + 5 * 60_000 + 9_000)).toBe('1:05:09');
  });

  it('treats bad input as zero', () => {
    expect(formatPlaytime(-5)).toBe('0:00');
    expect(formatPlaytime(Number.NaN)).toBe('0:00');
  });
});

describe('formatDate', () => {
  it('is the local date as YYYY-MM-DD (the same in every language)', () => {
    expect(formatDate(new Date(2026, 9, 2, 18, 30).getTime())).toBe('2026-10-02');
    expect(formatDate(new Date(2026, 0, 9).getTime())).toBe('2026-01-09');
  });
});

describe('formatPercent', () => {
  it('rounds 0..1 to a whole percent', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.6000000001)).toBe('60%');
    expect(formatPercent(1)).toBe('100%');
  });
});

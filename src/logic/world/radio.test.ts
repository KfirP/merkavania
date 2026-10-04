import { describe, expect, it } from 'vitest';
import {
  RADIO_BASE_SECONDS,
  RADIO_POINT_RADIUS,
  RADIO_SECONDS_PER_CHAR,
  RADIO_TYPE_RATE,
} from '../../data/radio';
import { inRadioRange, RadioQueue, radioDuration, revealedChars, stepRadios } from './radio';
import type { RadioSpec } from './objects';

const rect: RadioSpec = {
  key: 'c:intro',
  messageKey: 'radio.desert.intro',
  speaker: 'command',
  once: true,
  x: 100,
  y: 100,
  width: 40,
  height: 20,
};
const point: RadioSpec = { ...rect, key: 'c:p', x: 300, y: 300, width: 0, height: 0 };

describe('inRadioRange', () => {
  it('is inside a rect radio, or near a point radio', () => {
    expect(inRadioRange(rect, { x: 119, y: 109 })).toBe(true);
    expect(inRadioRange(rect, { x: 121, y: 100 })).toBe(false);
    expect(inRadioRange(point, { x: 300 + RADIO_POINT_RADIUS - 1, y: 300 })).toBe(true);
    expect(inRadioRange(point, { x: 300 + RADIO_POINT_RADIUS + 1, y: 300 })).toBe(false);
  });
});

describe('stepRadios', () => {
  const never = () => false;

  it('fires a radio when the pawn walks in, not again while it stays', () => {
    const first = stepRadios([rect], { x: 100, y: 100 }, new Set(), never);
    expect(first.fire).toEqual([rect]);
    const second = stepRadios([rect], { x: 101, y: 100 }, first.inside, never);
    expect(second.fire).toEqual([]);
  });

  it('a repeatable radio fires again on the next entry; a heard once radio never does', () => {
    const again = { ...rect, once: false };
    let inside = stepRadios([again], { x: 100, y: 100 }, new Set(), never).inside;
    inside = stepRadios([again], { x: 0, y: 0 }, inside, never).inside;
    expect(stepRadios([again], { x: 100, y: 100 }, inside, never).fire).toEqual([again]);
    expect(stepRadios([rect], { x: 100, y: 100 }, new Set(), () => true).fire).toEqual([]);
  });

  it('fires overlapping radios in map order', () => {
    const second = { ...rect, key: 'c:second' };
    expect(stepRadios([rect, second], { x: 100, y: 100 }, new Set(), never).fire).toEqual([
      rect,
      second,
    ]);
  });
});

describe('radio timing', () => {
  it('stays up for a base time plus a little per character', () => {
    expect(radioDuration('abcd')).toBeCloseTo(RADIO_BASE_SECONDS + 4 * RADIO_SECONDS_PER_CHAR);
  });

  it('types the text out', () => {
    expect(revealedChars('hello', 0)).toBe(0);
    expect(revealedChars('hello', 2 / RADIO_TYPE_RATE)).toBe(2);
    expect(revealedChars('hello', 99)).toBe(5);
  });
});

describe('RadioQueue', () => {
  const msg = (text: string) => ({ messageKey: 'k', speaker: 'command' as const, text });

  it('plays messages one at a time for their duration', () => {
    const q = new RadioQueue();
    q.push(msg('one'));
    q.push(msg('two'));
    expect(q.current?.text).toBe('one');
    q.tick(radioDuration('one') + 0.01);
    expect(q.current?.text).toBe('two');
    expect(q.current?.elapsed).toBe(0);
    q.tick(radioDuration('two') + 0.01);
    expect(q.current).toBeNull();
  });

  it('skip finishes the typing first, then moves on', () => {
    const q = new RadioQueue();
    q.push(msg('a long line'));
    q.push(msg('next'));
    q.skip();
    expect(q.current?.text).toBe('a long line');
    expect(revealedChars(q.current!.text, q.current!.elapsed)).toBe('a long line'.length);
    q.skip();
    expect(q.current?.text).toBe('next');
  });

  it('re-translates every message, keeping the one on screen where it was', () => {
    const q = new RadioQueue();
    q.push(msg('one'));
    q.push(msg('two'));
    q.tick(0.5);
    q.retext((m) => m.text.toUpperCase());
    expect([q.current!.text, ...q.queued.map((m) => m.text)]).toEqual(['ONE', 'TWO']);
    expect(q.current!.elapsed).toBe(0.5);
  });

  it('lists what is waiting', () => {
    const q = new RadioQueue();
    q.push(msg('one'));
    q.push(msg('two'));
    expect(q.queued.map((m) => m.text)).toEqual(['two']);
  });
});

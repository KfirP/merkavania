import { describe, expect, it } from 'vitest';
import { readCodepoints } from './fontCmap';

/** A minimal sfnt with one table, `cmap`, holding a single (3,1) format-4 subtable. */
function fakeFont(segments: { start: number; end: number }[]): Uint8Array {
  const segs = [...segments, { start: 0xffff, end: 0xffff }];
  const segX2 = segs.length * 2;
  const sub: number[] = [];
  const u16 = (arr: number[], v: number) => arr.push((v >> 8) & 0xff, v & 0xff);
  const subLen = 16 + segX2 * 4;
  u16(sub, 4); // format
  u16(sub, subLen);
  u16(sub, 0); // language
  u16(sub, segX2);
  u16(sub, 0);
  u16(sub, 0);
  u16(sub, 0);
  for (const s of segs) u16(sub, s.end);
  u16(sub, 0); // reservedPad
  for (const s of segs) u16(sub, s.start);
  for (const s of segs) u16(sub, s.start === 0xffff ? 1 : (1 - s.start) & 0xffff); // idDelta → glyph 1+
  for (let i = 0; i < segs.length; i++) u16(sub, 0); // idRangeOffset

  const cmap: number[] = [];
  u16(cmap, 0);
  u16(cmap, 1);
  u16(cmap, 3);
  u16(cmap, 1);
  cmap.push(0, 0, 0, 12); // offset of the subtable
  cmap.push(...sub);

  const head: number[] = [];
  head.push(0, 1, 0, 0); // sfnt version
  u16(head, 1); // numTables
  u16(head, 0);
  u16(head, 0);
  u16(head, 0);
  head.push(...'cmap'.split('').map((c) => c.charCodeAt(0)));
  head.push(0, 0, 0, 0); // checksum
  head.push(0, 0, 0, 28); // offset
  head.push(0, 0, (cmap.length >> 8) & 0xff, cmap.length & 0xff);
  return Uint8Array.from([...head, ...cmap]);
}

describe('readCodepoints', () => {
  it('reads the code points a format-4 cmap maps', () => {
    const cps = readCodepoints(
      fakeFont([
        { start: 0x41, end: 0x43 },
        { start: 0x5d0, end: 0x5d1 },
      ]),
    );
    expect([...cps].sort((a, b) => a - b)).toEqual([0x41, 0x42, 0x43, 0x5d0, 0x5d1]);
  });

  it('throws on something that is not a font', () => {
    expect(() => readCodepoints(new Uint8Array([1, 2, 3]))).toThrow();
  });
});

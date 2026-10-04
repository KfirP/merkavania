/**
 * Reads which Unicode code points a TrueType/OpenType font has glyphs for, from its `cmap` table
 * (formats 4 and 12). Enough to check the UI font covers every character in the i18n files
 * (docs/ARCHITECTURE.md, i18n) without a font library.
 */
export function readCodepoints(font: Uint8Array): Set<number> {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
  if (font.byteLength < 12) throw new Error('Not a font: too short');
  const numTables = view.getUint16(4);
  let cmap = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = String.fromCharCode(...font.subarray(rec, rec + 4));
    if (tag === 'cmap') cmap = view.getUint32(rec + 8);
  }
  if (cmap < 0) throw new Error('Not a font: no cmap table');

  const out = new Set<number>();
  const subtables = view.getUint16(cmap + 2);
  for (let i = 0; i < subtables; i++) {
    const platform = view.getUint16(cmap + 4 + i * 8);
    const encoding = view.getUint16(cmap + 6 + i * 8);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode) continue;
    const at = cmap + view.getUint32(cmap + 8 + i * 8);
    const format = view.getUint16(at);
    if (format === 4) readFormat4(view, at, out);
    else if (format === 12) readFormat12(view, at, out);
  }
  return out;
}

function readFormat4(view: DataView, at: number, out: Set<number>): void {
  const segCount = view.getUint16(at + 6) / 2;
  const ends = at + 14;
  const starts = ends + segCount * 2 + 2;
  const deltas = starts + segCount * 2;
  const rangeOffsets = deltas + segCount * 2;
  for (let s = 0; s < segCount; s++) {
    const end = view.getUint16(ends + s * 2);
    const start = view.getUint16(starts + s * 2);
    const delta = view.getUint16(deltas + s * 2);
    const roAt = rangeOffsets + s * 2;
    const ro = view.getUint16(roAt);
    for (let c = start; c <= end && c !== 0xffff; c++) {
      let glyph: number;
      if (ro === 0) glyph = (c + delta) & 0xffff;
      else {
        const g = view.getUint16(roAt + ro + (c - start) * 2);
        glyph = g === 0 ? 0 : (g + delta) & 0xffff;
      }
      if (glyph !== 0) out.add(c);
    }
  }
}

function readFormat12(view: DataView, at: number, out: Set<number>): void {
  const groups = view.getUint32(at + 12);
  for (let g = 0; g < groups; g++) {
    const start = view.getUint32(at + 16 + g * 12);
    const end = view.getUint32(at + 20 + g * 12);
    for (let c = start; c <= end; c++) out.add(c);
  }
}

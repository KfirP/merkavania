import { describe, expect, it } from 'vitest';
import { downscale, keyBackground, opaqueBounds, rotate90, trim, type Bitmap } from './sprites';

/** Builds a bitmap from rows of chars: '.' transparent, anything else an opaque grey of that code. */
function bmp(rows: string[]): Bitmap {
  const height = rows.length;
  const width = rows[0]!.length;
  const data = new Uint8Array(width * height * 4);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const i = (y * width + x) * 4;
      data.set([ch.charCodeAt(0), ch.charCodeAt(0), ch.charCodeAt(0), 255], i);
    }),
  );
  return { width, height, data };
}

function rows(b: Bitmap): string[] {
  const out: string[] = [];
  for (let y = 0; y < b.height; y++) {
    let row = '';
    for (let x = 0; x < b.width; x++) {
      const i = (y * b.width + x) * 4;
      row += b.data[i + 3]! < 128 ? '.' : String.fromCharCode(b.data[i]!);
    }
    out.push(row);
  }
  return out;
}

describe('opaqueBounds / trim', () => {
  const b = bmp(['....', '.ab.', '..c.', '....']);

  it('finds the opaque bounding box', () => {
    expect(opaqueBounds(b)).toEqual({ x: 1, y: 1, width: 2, height: 2 });
  });

  it('trims to it', () => {
    expect(rows(trim(b))).toEqual(['ab', '.c']);
  });
});

describe('rotate90', () => {
  it('turns a north-facing sprite east (clockwise)', () => {
    expect(rows(rotate90(bmp(['ab', 'cd', 'ef'])))).toEqual(['eca', 'fdb']);
  });
});

describe('downscale', () => {
  it('keeps the majority colour of each block', () => {
    expect(rows(downscale(bmp(['aaab', 'abbb']), 2))).toEqual(['ab']);
  });

  it('makes a block transparent when most of it is', () => {
    expect(rows(downscale(bmp(['a...', '..bb']), 2))).toEqual(['.b']);
  });
});

describe('keyBackground', () => {
  it('clears the border-connected background colour but keeps enclosed pixels of it', () => {
    expect(rows(keyBackground(bmp(['zzzzz', 'zaaaz', 'zazaz', 'zaaaz', 'zzzzz']), 0))).toEqual([
      '.....',
      '.aaa.',
      '.aza.',
      '.aaa.',
      '.....',
    ]);
  });

  it('treats close colours as background within the tolerance', () => {
    expect(rows(keyBackground(bmp(['zy', 'ya']), 2))).toEqual(['..', '.a']);
  });
});

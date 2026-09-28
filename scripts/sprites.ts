/** Pure RGBA bitmap operations for turning raw generations into game sprites (ASSET_PIPELINE.md). */

export interface Bitmap {
  width: number;
  height: number;
  /** RGBA, row-major. */
  data: Uint8Array;
}

const ALPHA_CUTOFF = 128;

const opaqueAt = (b: Bitmap, x: number, y: number) =>
  b.data[(y * b.width + x) * 4 + 3]! >= ALPHA_CUTOFF;

function blank(width: number, height: number): Bitmap {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

function copyPixel(from: Bitmap, fx: number, fy: number, to: Bitmap, tx: number, ty: number) {
  const s = (fy * from.width + fx) * 4;
  to.data.set(from.data.subarray(s, s + 4), (ty * to.width + tx) * 4);
}

/** Smallest rectangle holding every opaque pixel (the whole image if none are). */
export function opaqueBounds(b: Bitmap): { x: number; y: number; width: number; height: number } {
  let x0 = b.width;
  let y0 = b.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < b.height; y++)
    for (let x = 0; x < b.width; x++)
      if (opaqueAt(b, x, y)) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  if (x1 < 0) return { x: 0, y: 0, width: b.width, height: b.height };
  return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** Crops away transparent padding. */
export function trim(b: Bitmap): Bitmap {
  const r = opaqueBounds(b);
  const out = blank(r.width, r.height);
  for (let y = 0; y < r.height; y++)
    for (let x = 0; x < r.width; x++) copyPixel(b, r.x + x, r.y + y, out, x, y);
  return out;
}

/** Rotates 90° clockwise: a sprite facing north ends up facing east. */
export function rotate90(b: Bitmap): Bitmap {
  const out = blank(b.height, b.width);
  for (let y = 0; y < b.height; y++)
    for (let x = 0; x < b.width; x++) copyPixel(b, x, y, out, b.height - 1 - y, x);
  return out;
}

/**
 * Shrinks by an integer `factor` without blending: each block becomes its most common opaque
 * colour, or transparent when more than half of it is transparent.
 */
export function downscale(b: Bitmap, factor: number): Bitmap {
  const out = blank(Math.floor(b.width / factor), Math.floor(b.height / factor));
  for (let oy = 0; oy < out.height; oy++)
    for (let ox = 0; ox < out.width; ox++) {
      const counts = new Map<number, { n: number; x: number; y: number }>();
      let clear = 0;
      for (let dy = 0; dy < factor; dy++)
        for (let dx = 0; dx < factor; dx++) {
          const x = ox * factor + dx;
          const y = oy * factor + dy;
          if (!opaqueAt(b, x, y)) {
            clear++;
            continue;
          }
          const i = (y * b.width + x) * 4;
          const key = (b.data[i]! << 16) | (b.data[i + 1]! << 8) | b.data[i + 2]!;
          const c = counts.get(key) ?? { n: 0, x, y };
          c.n++;
          counts.set(key, c);
        }
      if (clear * 2 > factor * factor) continue;
      const best = [...counts.values()].sort((a, c) => c.n - a.n)[0]!;
      copyPixel(b, best.x, best.y, out, ox, oy);
    }
  return out;
}

/**
 * Makes an opaque background transparent: clears every pixel connected to the image border whose
 * colour is within `tolerance` (per channel) of the top-left pixel. Enclosed pixels of the same
 * colour stay, so a sprite's own sandy patches survive.
 */
export function keyBackground(b: Bitmap, tolerance: number): Bitmap {
  const out: Bitmap = { width: b.width, height: b.height, data: new Uint8Array(b.data) };
  const key = [b.data[0]!, b.data[1]!, b.data[2]!];
  const matches = (x: number, y: number) => {
    const i = (y * b.width + x) * 4;
    return (
      out.data[i + 3]! >= ALPHA_CUTOFF &&
      key.every((k, c) => Math.abs(out.data[i + c]! - k) <= tolerance)
    );
  };
  const stack: [number, number][] = [];
  for (let x = 0; x < b.width; x++) stack.push([x, 0], [x, b.height - 1]);
  for (let y = 0; y < b.height; y++) stack.push([0, y], [b.width - 1, y]);
  while (stack.length) {
    const [x, y] = stack.pop()!;
    if (x < 0 || y < 0 || x >= b.width || y >= b.height || !matches(x, y)) continue;
    out.data[(y * b.width + x) * 4 + 3] = 0;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return out;
}

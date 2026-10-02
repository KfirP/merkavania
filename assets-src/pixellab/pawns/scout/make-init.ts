/**
 * Draws the 32×32 init image for the scout's pixflux generation: a top-down IDF soldier facing
 * east (helmet, shoulders, backpack, rifle). The 10px code placeholder scaled up came back as a
 * blob for the rifle soldier, so this gives PixelLab a clearer layout to redraw.
 *   npx tsx assets-src/pixellab/pawns/scout/make-init.ts
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const S = 32;
const png = new PNG({ width: S, height: S });
const put = (x: number, y: number, rgb: number) => {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const i = (y * S + x) * 4;
  png.data[i] = (rgb >> 16) & 255;
  png.data[i + 1] = (rgb >> 8) & 255;
  png.data[i + 2] = rgb & 255;
  png.data[i + 3] = 255;
};
const ellipse = (cx: number, cy: number, rx: number, ry: number, rgb: number) => {
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++)
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) put(x, y, rgb);
};
const rect = (x0: number, y0: number, w: number, h: number, rgb: number) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, rgb);
};

const OUTLINE = 0x1f1f10;
const OLIVE = 0x6b6b3a;
const OLIVE_DARK = 0x4e4e2a;
const OLIVE_LIGHT = 0x85854a;
const SKIN = 0xc8a07a;
const GUN = 0x2a2a22;

// Shoulders (wide across the body, which faces east), with a backpack behind (west).
ellipse(15, 16, 7, 11, OUTLINE);
ellipse(15, 16, 6, 10, OLIVE_DARK);
rect(7, 11, 5, 10, OUTLINE);
rect(8, 12, 4, 8, OLIVE);
// Arms reaching forward to the rifle.
rect(17, 19, 7, 3, OUTLINE);
rect(18, 20, 6, 1, OLIVE);
rect(23, 19, 2, 3, SKIN);
// Rifle pointing east from the right shoulder.
rect(17, 20, 13, 2, GUN);
// Helmet on top, lit from the top-left.
ellipse(16, 15, 5.5, 5.5, OUTLINE);
ellipse(16, 15, 4.5, 4.5, OLIVE);
ellipse(15, 14, 2, 2, OLIVE_LIGHT);

writeFileSync(fileURLToPath(new URL('./init.png', import.meta.url)), PNG.sync.write(png));

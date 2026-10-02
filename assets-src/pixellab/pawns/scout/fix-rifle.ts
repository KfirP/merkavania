/**
 * raw-v2.png (PixelLab) has the right top-down silhouette, but its rifle came out as a reddish
 * stub. This removes the stub and redraws the rifle as in init.png: raw-v2.png → fixed.png.
 *   npx tsx assets-src/pixellab/pawns/scout/fix-rifle.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const at = (name: string) => fileURLToPath(new URL(`./${name}`, import.meta.url));
const png = PNG.sync.read(readFileSync(at('raw-v2.png')));
const S = png.width;
const idx = (x: number, y: number) => (y * S + x) * 4;

// The stub: reddish-brown pixels (red well above green), all right of the body's centre.
for (let y = 0; y < png.height; y++)
  for (let x = S / 2; x < S; x++) {
    const i = idx(x, y);
    const [r, g, a] = [png.data[i]!, png.data[i + 1]!, png.data[i + 3]!];
    if (a > 0 && r > g + 30) png.data[i + 3] = 0;
  }

const put = (x: number, y: number, rgb: number) => {
  const i = idx(x, y);
  png.data[i] = (rgb >> 16) & 255;
  png.data[i + 1] = (rgb >> 8) & 255;
  png.data[i + 2] = rgb & 255;
  png.data[i + 3] = 255;
};
// Rifle: 2px dark barrel from the right shoulder to the edge, outlined, with a hand on it.
const OUTLINE = 0x1f1f10;
const GUN = 0x3a3a30;
const SKIN = 0xc8a07a;
for (let x = 18; x <= 29; x++) {
  put(x, 19, OUTLINE);
  put(x, 20, GUN);
  put(x, 21, GUN);
  put(x, 22, OUTLINE);
}
put(30, 20, OUTLINE);
put(30, 21, OUTLINE);
put(22, 20, SKIN);
put(22, 21, SKIN);

writeFileSync(at('fixed.png'), PNG.sync.write(png));

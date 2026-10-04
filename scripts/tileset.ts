/**
 * Shared tileset output for the tile generators (gen-placeholder-tiles.ts, gen-desert-tiles.ts):
 * a dependency-free RGBA PNG encoder and `writeTileset`, which draws each tile's painter into a
 * sheet and writes the `.tsj` beside it.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

export const T = 16;
const COLUMNS = 8;
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));

export type RGBA = [number, number, number, number];
export type Pixels = (x: number, y: number) => RGBA | null;

export interface TileDef {
  draw: Pixels;
  properties?: { name: string; type: 'string' | 'int' | 'bool'; value: unknown }[];
}

// --- PNG encoding (RGBA, no dependencies) ---

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++)
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function writeTileset(
  name: string,
  imagePath: string,
  tsjPath: string,
  tiles: TileDef[],
): void {
  const rows = Math.ceil(tiles.length / COLUMNS);
  const width = COLUMNS * T;
  const height = rows * T;
  const rgba = Buffer.alloc(width * height * 4);
  tiles.forEach((tile, id) => {
    const ox = (id % COLUMNS) * T;
    const oy = Math.floor(id / COLUMNS) * T;
    for (let y = 0; y < T; y++)
      for (let x = 0; x < T; x++) {
        const px = tile.draw(x, y);
        if (px) rgba.set(px, ((oy + y) * width + ox + x) * 4);
      }
  });

  const imageFile = join(PUBLIC, imagePath);
  const tsjFile = join(PUBLIC, tsjPath);
  mkdirSync(dirname(imageFile), { recursive: true });
  mkdirSync(dirname(tsjFile), { recursive: true });
  writeFileSync(imageFile, encodePng(width, height, rgba));

  const tsj = {
    columns: COLUMNS,
    image: relative(dirname(tsjFile), imageFile).replaceAll('\\', '/'),
    imageheight: height,
    imagewidth: width,
    margin: 0,
    name,
    spacing: 0,
    tilecount: tiles.length,
    tiledversion: '1.11.2',
    tileheight: T,
    tiles: tiles.map((t, id) => ({ id, properties: t.properties ?? [] })),
    tilewidth: T,
    type: 'tileset',
    version: '1.10',
  };
  writeFileSync(tsjFile, JSON.stringify(tsj, null, 2) + '\n');
  console.log(`${tsjPath}: ${tiles.length} tiles`);
}

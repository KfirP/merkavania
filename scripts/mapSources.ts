import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { desertPalette } from './desertTiles';
import { buildWorld, type TilePalette } from './mapBuild';
import type { ChunkLayout } from './mapLayout';

/**
 * Finds the built biomes under maps-src/ and builds them in memory (scripts/build-maps.ts writes
 * the result; scripts/build-maps.test.ts checks the committed files match).
 */

const SOURCES = new URL('../maps-src/', import.meta.url);
export const PUBLIC_MAPS = new URL('../public/maps/', import.meta.url);

/** Each built biome's tileset palette. */
const palettes: Record<string, TilePalette> = { desert: desertPalette };

export function builtBiomes(): string[] {
  return readdirSync(SOURCES, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

/** Output file (relative to public/maps/) → contents. */
export async function buildBiome(biome: string): Promise<Map<string, string>> {
  const palette = palettes[biome];
  if (!palette) throw new Error(`maps-src/${biome}: no tile palette registered in mapSources.ts`);
  const dir = new URL(`${biome}/`, SOURCES);
  const layouts = new Map<string, ChunkLayout>();
  for (const file of readdirSync(dir)
    .filter((f) => /^x\d\d_y\d\d\.ts$/.test(f))
    .sort()) {
    const mod = (await import(pathToFileURL(fileURLToPath(new URL(file, dir))).href)) as {
      default: ChunkLayout;
    };
    layouts.set(file.slice(0, -3), mod.default);
  }
  const { world, maps } = buildWorld(biome, layouts, palette);
  const out = new Map<string, string>();
  out.set(`${biome}/${biome}.world`, JSON.stringify(world, null, 4) + '\n');
  for (const [name, map] of maps) out.set(`${biome}/${name}`, JSON.stringify(map) + '\n');
  return out;
}

/** The committed file, or null if it's missing. */
export function committed(path: string): string | null {
  try {
    return readFileSync(new URL(path, PUBLIC_MAPS), 'utf8');
  } catch {
    return null;
  }
}

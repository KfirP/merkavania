/**
 * Validates every Tiled map, world and tileset under public/maps (see docs/LEVEL_DESIGN.md).
 * This script only reads files; the rules live in src/logic/world/validate.ts.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetManifest } from '../src/data/assetManifest';
import en from '../src/i18n/en.json' with { type: 'json' };
import { parseWorld, type TiledWorld } from '../src/logic/world/world';
import {
  formatIssue,
  validateStandaloneMap,
  validateTileset,
  validateWorlds,
  type KnownIds,
  type MapIssue,
} from '../src/logic/world/validate';

const MAP_EXTENSIONS = ['.world', '.tmj', '.tsj'];

export function findMapFiles(root: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const path = join(root, name);
    if (statSync(path).isDirectory()) return findMapFiles(path);
    return MAP_EXTENSIONS.some((ext) => name.endsWith(ext)) ? [path] : [];
  });
}

const known: KnownIds = {
  imageAssets: new Map(assetManifest.filter((a) => a.type === 'image').map((a) => [a.key, a.path])),
  messageKeys: new Set(Object.keys(en)),
};

/** Validates everything under `<publicDir>/maps`; file paths are public/-relative, with '/'. */
export function validateAll(publicDir: string): { files: string[]; issues: MapIssue[] } {
  const files = findMapFiles(join(publicDir, 'maps')).map((f) =>
    relative(publicDir, f).split(sep).join('/'),
  );
  const issues: MapIssue[] = [];
  const parsed = new Map<string, unknown>();
  for (const file of files) {
    try {
      parsed.set(file, JSON.parse(readFileSync(join(publicDir, file), 'utf8')));
    } catch (err) {
      issues.push({ file, message: `invalid JSON: ${(err as Error).message}` });
    }
  }
  const load = (path: string) => parsed.get(path);

  for (const file of files.filter((f) => f.endsWith('.tsj') && parsed.has(f)))
    issues.push(...validateTileset(file, parsed.get(file), known));

  const worlds = files.filter((f) => f.endsWith('.world') && parsed.has(f));
  issues.push(...validateWorlds(worlds, load, known));

  const inWorlds = new Set<string>();
  for (const w of worlds)
    try {
      for (const c of parseWorld(parsed.get(w) as TiledWorld, w).chunks) inWorlds.add(c.path);
    } catch {
      // already reported by validateWorlds
    }
  for (const file of files.filter((f) => f.endsWith('.tmj') && parsed.has(f)))
    if (!inWorlds.has(file))
      issues.push(...validateStandaloneMap(file, parsed.get(file), load, known));

  return { files, issues };
}

function main(): void {
  const { files, issues } = validateAll(fileURLToPath(new URL('../public/', import.meta.url)));
  for (const issue of issues) console.error(formatIssue(issue));
  console.log(`validate:maps: ${files.length} file(s) checked, ${issues.length} issue(s).`);
  if (issues.length > 0) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();

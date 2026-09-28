/**
 * Validates every Tiled map and world under public/maps (see docs/LEVEL_DESIGN.md).
 * M0 stub: finds and parses the files. The real rules arrive in M2 and M4.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAP_EXTENSIONS = ['.world', '.tmj', '.tsj'];

export interface MapIssue {
  file: string;
  message: string;
}

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

export function validateMapFiles(files: string[], root: string): MapIssue[] {
  const issues: MapIssue[] = [];
  for (const file of files) {
    try {
      JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      issues.push({
        file: relative(root, file),
        message: `invalid JSON: ${(err as Error).message}`,
      });
    }
  }
  return issues;
}

function main(): void {
  const root = fileURLToPath(new URL('../public/maps', import.meta.url));
  const files = findMapFiles(root);
  const issues = validateMapFiles(files, root);
  for (const issue of issues) console.error(`${issue.file}: ${issue.message}`);
  console.log(`validate:maps: ${files.length} file(s) checked, ${issues.length} issue(s).`);
  if (issues.length > 0) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();

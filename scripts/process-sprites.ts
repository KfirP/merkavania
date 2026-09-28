/**
 * Turns raw PixelLab generations (assets-src/pixellab) into game-ready sprites
 * (public/assets/sprites), per docs/ASSET_PIPELINE.md. Re-run after changing a source or step:
 *   npx tsx scripts/process-sprites.ts
 * Prints each output's size so manifest origins can be checked.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { downscale, keyBackground, rotate90, trim, type Bitmap } from './sprites';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** `key<n>`: remove the background colour, tolerance n (for outputs that came back opaque). */
type Step = 'trim' | 'rotate90' | `downscale${number}` | `key${number}`;

interface Job {
  /** Relative to assets-src/pixellab. */
  from: string;
  /** Relative to public/assets/sprites. */
  to: string;
  steps: Step[];
}

const JOBS: Job[] = [
  { from: 'enemies/technical/raw-v2.png', to: 'enemies/technical.png', steps: ['trim'] },
  { from: 'enemies/bunker/raw-v2.png', to: 'enemies/bunker.png', steps: ['trim'] },
  {
    from: 'enemies/atgm_team/raw-v2.png',
    to: 'enemies/atgm_team.png',
    steps: ['trim', 'key24', 'trim', 'downscale2'],
  },
  {
    // Generated facing north; the game wants east.
    from: 'enemies/light_tank_hull/raw.png',
    to: 'enemies/light_tank_hull.png',
    steps: ['trim', 'rotate90'],
  },
  {
    from: 'enemies/light_tank_turret/raw-v2.png',
    to: 'enemies/light_tank_turret.png',
    steps: ['trim'],
  },
  ...(['sandbag', 'wood', 'concrete', 'armored'] as const).map((m) => ({
    from: `destructibles/${m}/raw.png`,
    to: `destructibles/${m}.png`,
    steps: ['trim', 'downscale2'] as Step[],
  })),
  { from: 'effects/explosion/raw.png', to: 'effects/explosion.png', steps: ['trim'] },
];

function apply(b: Bitmap, step: Step): Bitmap {
  if (step === 'trim') return trim(b);
  if (step === 'rotate90') return rotate90(b);
  if (step.startsWith('key')) return keyBackground(b, Number(step.slice('key'.length)));
  return downscale(b, Number(step.slice('downscale'.length)));
}

for (const job of JOBS) {
  const png = PNG.sync.read(readFileSync(`${ROOT}assets-src/pixellab/${job.from}`));
  let b: Bitmap = { width: png.width, height: png.height, data: new Uint8Array(png.data) };
  for (const step of job.steps) b = apply(b, step);
  const out = new PNG({ width: b.width, height: b.height });
  out.data = Buffer.from(b.data);
  const path = `${ROOT}public/assets/sprites/${job.to}`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, PNG.sync.write(out));
  console.log(`${job.to}: ${b.width}×${b.height}`);
}

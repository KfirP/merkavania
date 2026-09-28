/** The only place asset paths appear; code refers to assets by key. See docs/ASSET_PIPELINE.md. */
export type AssetStatus = 'placeholder' | 'generated' | 'final';

export interface AssetEntry {
  key: string;
  type: 'image' | 'spritesheet' | 'audio' | 'json';
  /**
   * Relative to public/. Empty means Preload draws the texture in code (see game/placeholders.ts).
   * A placeholder may still have a file (e.g. a flat-colour tileset Tiled needs to open).
   */
  path: string;
  status: AssetStatus;
  /** Rotation pivot, 0..1 (e.g. turret pivot). */
  origin?: { x: number; y: number };
  frame?: { width: number; height: number };
}

export const assetManifest = [
  { key: 'mk2_hull', type: 'image', path: '', status: 'placeholder', origin: { x: 0.5, y: 0.5 } },
  // Pivot sits on the turret ring; the barrel extends east of it.
  {
    key: 'mk2_turret',
    type: 'image',
    path: '',
    status: 'placeholder',
    origin: { x: 9 / 34, y: 0.5 },
  },
  { key: 'shell_105', type: 'image', path: '', status: 'placeholder' },
  { key: 'bullet_mg', type: 'image', path: '', status: 'placeholder' },
  { key: 'muzzle_flash', type: 'image', path: '', status: 'placeholder', origin: { x: 0, y: 0.5 } },
  { key: 'impact_puff', type: 'image', path: '', status: 'placeholder' },
  {
    key: 'tiles_test',
    type: 'image',
    path: 'assets/tiles/test/placeholder.png',
    status: 'placeholder',
  },
  { key: 'map_test_room', type: 'json', path: 'maps/test/test_room.tmj', status: 'final' },
] as const satisfies readonly AssetEntry[];

export type AssetKey = (typeof assetManifest)[number]['key'];

export function getAsset(key: AssetKey): AssetEntry {
  const entry = assetManifest.find((a) => a.key === key);
  if (!entry) throw new Error(`Unknown asset key "${key}"`);
  return entry;
}

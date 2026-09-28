/** The only place asset paths appear; code refers to assets by key. See docs/ASSET_PIPELINE.md. */
export type AssetStatus = 'placeholder' | 'generated' | 'final';

export interface AssetEntry {
  key: string;
  type: 'image' | 'spritesheet' | 'audio';
  /** Relative to public/. Unused while status is 'placeholder' (Preload draws the texture). */
  path: string;
  status: AssetStatus;
  /** Rotation pivot, 0..1 (e.g. turret pivot). */
  origin?: { x: number; y: number };
  frame?: { width: number; height: number };
}

export const assetManifest: readonly AssetEntry[] = [];

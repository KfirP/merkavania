/** The only place asset paths appear; code refers to assets by key. See docs/ASSET_PIPELINE.md. */
export type AssetStatus = 'placeholder' | 'generated' | 'final';

export interface AssetEntry {
  key: string;
  type: 'image' | 'spritesheet' | 'audio' | 'json' | 'font';
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
  // UI font: Latin + Hebrew, crisp at 8px multiples (CC0, see the licence file next to it).
  { key: 'font_ui', type: 'font', path: 'assets/fonts/PublicPixel.ttf', status: 'final' },
  { key: 'mk2_hull', type: 'image', path: '', status: 'placeholder', origin: { x: 0.5, y: 0.5 } },
  // Pivot sits on the turret ring; the barrel extends east of it.
  {
    key: 'mk2_turret',
    type: 'image',
    path: '',
    status: 'placeholder',
    origin: { x: 9 / 34, y: 0.5 },
  },
  { key: 'mk3_hull', type: 'image', path: '', status: 'placeholder', origin: { x: 0.5, y: 0.5 } },
  {
    key: 'mk3_turret',
    type: 'image',
    path: '',
    status: 'placeholder',
    origin: { x: 10 / 38, y: 0.5 },
  },
  { key: 'shell_105', type: 'image', path: '', status: 'placeholder' },
  { key: 'shell_120', type: 'image', path: '', status: 'placeholder' },
  { key: 'bullet_mg', type: 'image', path: '', status: 'placeholder' },
  { key: 'missile_atgm', type: 'image', path: '', status: 'placeholder' },
  { key: 'shell_mortar', type: 'image', path: '', status: 'placeholder' },
  { key: 'shadow', type: 'image', path: '', status: 'placeholder' },
  { key: 'pickup', type: 'image', path: '', status: 'placeholder' },
  { key: 'depot_pad', type: 'image', path: '', status: 'placeholder' },
  { key: 'switch_off', type: 'image', path: '', status: 'placeholder' },
  { key: 'switch_on', type: 'image', path: '', status: 'placeholder' },
  { key: 'door', type: 'image', path: '', status: 'placeholder' },
  { key: 'boulder', type: 'image', path: '', status: 'placeholder' },
  { key: 'enemy_rifle_soldier', type: 'image', path: '', status: 'placeholder' },
  { key: 'scout', type: 'image', path: 'assets/sprites/pawns/scout.png', status: 'generated' },
  {
    key: 'enemy_technical',
    type: 'image',
    path: 'assets/sprites/enemies/technical.png',
    status: 'generated',
  },
  {
    key: 'enemy_bunker',
    type: 'image',
    path: 'assets/sprites/enemies/bunker.png',
    status: 'generated',
  },
  {
    key: 'enemy_atgm_team',
    type: 'image',
    path: 'assets/sprites/enemies/atgm_team.png',
    status: 'generated',
  },
  {
    key: 'enemy_light_tank_hull',
    type: 'image',
    path: 'assets/sprites/enemies/light_tank_hull.png',
    status: 'generated',
  },
  // Pivot on the turret ring; the barrel extends east of it.
  {
    key: 'enemy_light_tank_turret',
    type: 'image',
    path: 'assets/sprites/enemies/light_tank_turret.png',
    status: 'generated',
    origin: { x: 6 / 24, y: 0.5 },
  },
  {
    key: 'destructible_sandbag',
    type: 'image',
    path: 'assets/sprites/destructibles/sandbag.png',
    status: 'generated',
  },
  {
    key: 'destructible_wood',
    type: 'image',
    path: 'assets/sprites/destructibles/wood.png',
    status: 'generated',
  },
  {
    key: 'destructible_concrete',
    type: 'image',
    path: 'assets/sprites/destructibles/concrete.png',
    status: 'generated',
  },
  {
    key: 'destructible_armored',
    type: 'image',
    path: 'assets/sprites/destructibles/armored.png',
    status: 'generated',
  },
  { key: 'mk_upgrade', type: 'image', path: '', status: 'placeholder' },
  { key: 'boss_desert_bunker', type: 'image', path: '', status: 'placeholder' },
  // Pivot on the gun's turntable; the barrel extends east of it.
  {
    key: 'boss_desert_gun',
    type: 'image',
    path: '',
    status: 'placeholder',
    origin: { x: 10 / 40, y: 0.5 },
  },
  { key: 'muzzle_flash', type: 'image', path: '', status: 'placeholder', origin: { x: 0, y: 0.5 } },
  { key: 'impact_puff', type: 'image', path: '', status: 'placeholder' },
  { key: 'spark', type: 'image', path: '', status: 'placeholder' },
  {
    key: 'explosion',
    type: 'image',
    path: 'assets/sprites/effects/explosion.png',
    status: 'generated',
  },
  {
    key: 'tiles_test',
    type: 'image',
    path: 'assets/tiles/test/placeholder.png',
    status: 'placeholder',
  },
  {
    key: 'tiles_test_terrain',
    type: 'image',
    path: 'assets/tiles/test/terrain.png',
    status: 'placeholder',
  },
  // Desert terrain, drawn in code by scripts/gen-desert-tiles.ts (desert palette).
  {
    key: 'tiles_desert',
    type: 'image',
    path: 'assets/tiles/desert/desert.png',
    status: 'final',
  },
  // Elevation data tiles: shown in Tiled only (the layer is hidden in game).
  { key: 'tiles_elevation', type: 'image', path: 'assets/tiles/elevation.png', status: 'final' },
  { key: 'world_test', type: 'json', path: 'maps/test/test.world', status: 'final' },
  // Built from maps-src/desert by `npm run build:maps`.
  { key: 'world_desert', type: 'json', path: 'maps/desert/desert.world', status: 'final' },
] as const satisfies readonly AssetEntry[];

export type AssetKey = (typeof assetManifest)[number]['key'];

export function getAsset(key: AssetKey): AssetEntry {
  const entry = assetManifest.find((a) => a.key === key);
  if (!entry) throw new Error(`Unknown asset key "${key}"`);
  return entry;
}

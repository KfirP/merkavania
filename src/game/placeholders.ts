import type Phaser from 'phaser';
import type { AssetKey } from '../data/assetManifest';

/** Code-drawn stand-ins for manifest entries without a file. All face east (0 rad). */
type Draw = (g: Phaser.GameObjects.Graphics) => { width: number; height: number };

const OUTLINE = 0x1f1f10;
const OLIVE = 0x6b6b3a;
const OLIVE_LIGHT = 0x85854a;
const TRACK = 0x3a3a26;
/** Enemies wear rust and brown so they never read as the olive player tank. */
const ENEMY_KHAKI = 0xb07a4a;
const ENEMY_DARK = 0x7a4e2e;

const drawers: Partial<Record<AssetKey, Draw>> = {
  mk2_hull: (g) => {
    // Tracks
    g.fillStyle(OUTLINE).fillRect(1, 3, 30, 7).fillRect(1, 22, 30, 7);
    g.fillStyle(TRACK).fillRect(2, 4, 28, 5).fillRect(2, 23, 28, 5);
    g.fillStyle(0x55553a);
    for (let x = 3; x < 30; x += 3) g.fillRect(x, 4, 1, 5).fillRect(x, 23, 1, 5);
    // Hull with a sloped front glacis (engine is at the front on a Merkava).
    g.fillStyle(OUTLINE).fillPoints(
      [
        { x: 2, y: 7 },
        { x: 25, y: 7 },
        { x: 31, y: 11 },
        { x: 31, y: 21 },
        { x: 25, y: 25 },
        { x: 2, y: 25 },
      ],
      true,
    );
    g.fillStyle(OLIVE).fillRect(3, 8, 22, 16);
    g.fillStyle(OLIVE_LIGHT).fillPoints(
      [
        { x: 24, y: 8 },
        { x: 30, y: 12 },
        { x: 30, y: 20 },
        { x: 24, y: 24 },
      ],
      true,
    );
    // Engine deck grille and rear hatch.
    g.fillStyle(0x4f4f2c).fillRect(19, 12, 4, 8);
    g.fillStyle(0x4f4f2c).fillRect(3, 13, 2, 6);
    return { width: 32, height: 32 };
  },
  mk2_turret: (g) => {
    // Barrel: pivot is at x=9, tip at x=34.
    g.fillStyle(OUTLINE).fillRect(16, 4, 18, 4);
    g.fillStyle(0x4a4a2a).fillRect(17, 5, 17, 2);
    // Long flat wedge turret.
    g.fillStyle(OUTLINE).fillPoints(
      [
        { x: 0, y: 1 },
        { x: 12, y: 0 },
        { x: 20, y: 4 },
        { x: 20, y: 8 },
        { x: 12, y: 12 },
        { x: 0, y: 11 },
      ],
      true,
    );
    g.fillStyle(OLIVE_LIGHT).fillPoints(
      [
        { x: 1, y: 2 },
        { x: 12, y: 1 },
        { x: 19, y: 5 },
        { x: 19, y: 7 },
        { x: 12, y: 11 },
        { x: 1, y: 10 },
      ],
      true,
    );
    // Commander's cupola.
    g.fillStyle(OLIVE).fillRect(5, 3, 4, 3);
    return { width: 34, height: 12 };
  },
  shell_105: (g) => {
    g.fillStyle(0xfff2a8).fillRect(0, 0, 6, 2);
    g.fillStyle(0xffffff).fillRect(4, 0, 2, 2);
    return { width: 6, height: 2 };
  },
  bullet_mg: (g) => {
    g.fillStyle(0xffe070).fillRect(0, 0, 3, 1);
    return { width: 3, height: 1 };
  },
  missile_atgm: (g) => {
    g.fillStyle(OUTLINE).fillRect(0, 0, 8, 4);
    g.fillStyle(0x7a7a6a).fillRect(1, 1, 6, 2);
    g.fillStyle(0xd6453e).fillRect(6, 1, 2, 2);
    g.fillStyle(0xffb030).fillRect(0, 1, 1, 2);
    return { width: 8, height: 4 };
  },
  enemy_rifle_soldier: (g) => {
    // Helmet from above, shoulders and a rifle pointing east.
    g.fillStyle(OUTLINE).fillCircle(4, 4, 4);
    g.fillStyle(ENEMY_KHAKI).fillCircle(4, 4, 3);
    g.fillStyle(ENEMY_DARK).fillCircle(4, 4, 2);
    g.fillStyle(OUTLINE).fillRect(5, 5, 5, 1);
    return { width: 10, height: 9 };
  },
  enemy_technical: (g) => {
    // Pickup truck: cab at the front (east), MG in the bed.
    g.fillStyle(OUTLINE).fillRect(0, 2, 24, 12);
    g.fillStyle(0xd8d0b8).fillRect(1, 3, 22, 10);
    g.fillStyle(0x9aa4a8).fillRect(14, 4, 6, 8);
    g.fillStyle(0x5a5a50).fillRect(2, 4, 10, 8);
    g.fillStyle(OUTLINE).fillRect(6, 7, 8, 2);
    g.fillStyle(OUTLINE).fillRect(2, 0, 4, 2).fillRect(17, 0, 4, 2);
    g.fillRect(2, 14, 4, 2).fillRect(17, 14, 4, 2);
    return { width: 24, height: 16 };
  },
  enemy_bunker: (g) => {
    // Squat concrete pillbox with its firing slit on the east face.
    g.fillStyle(OUTLINE).fillRoundedRect(0, 0, 28, 28, 6);
    g.fillStyle(0xa89c80).fillRoundedRect(1, 1, 26, 26, 5);
    g.fillStyle(0xc2b595).fillRoundedRect(5, 5, 18, 18, 4);
    g.fillStyle(OUTLINE).fillRect(22, 11, 6, 6);
    return { width: 28, height: 28 };
  },
  enemy_atgm_team: (g) => {
    // Two soldiers with a launcher tube between them.
    g.fillStyle(OUTLINE).fillCircle(4, 3, 3).fillCircle(4, 11, 3);
    g.fillStyle(ENEMY_KHAKI).fillCircle(4, 3, 2).fillCircle(4, 11, 2);
    g.fillStyle(OUTLINE).fillRect(3, 6, 11, 3);
    g.fillStyle(0x6e7a5a).fillRect(4, 7, 9, 1);
    return { width: 14, height: 14 };
  },
  enemy_light_tank_hull: (g) => {
    g.fillStyle(OUTLINE).fillRect(0, 1, 26, 6).fillRect(0, 19, 26, 6);
    g.fillStyle(0x3d3a2c).fillRect(1, 2, 24, 4).fillRect(1, 20, 24, 4);
    g.fillStyle(OUTLINE).fillRect(1, 5, 25, 16);
    g.fillStyle(ENEMY_DARK).fillRect(2, 6, 23, 14);
    g.fillStyle(0x8a7a52).fillRect(20, 7, 4, 12);
    return { width: 26, height: 26 };
  },
  enemy_light_tank_turret: (g) => {
    // Pivot at x=7; round turret with a short barrel.
    g.fillStyle(OUTLINE).fillRect(12, 4, 14, 2);
    g.fillStyle(OUTLINE).fillCircle(7, 5, 6);
    g.fillStyle(ENEMY_KHAKI).fillCircle(7, 5, 5);
    g.fillStyle(ENEMY_DARK).fillRect(5, 3, 3, 3);
    return { width: 26, height: 11 };
  },
  destructible_sandbag: (g) => {
    g.fillStyle(OUTLINE).fillRect(0, 2, 16, 12);
    g.fillStyle(0xc2a66b);
    for (const [x, y] of [
      [1, 3],
      [6, 3],
      [11, 3],
      [3, 8],
      [8, 8],
    ] as const)
      g.fillRoundedRect(x, y, 5, 4, 1);
    return { width: 16, height: 16 };
  },
  destructible_wood: (g) => {
    g.fillStyle(OUTLINE).fillRect(1, 1, 14, 14);
    g.fillStyle(0x8a5a2b).fillRect(2, 2, 12, 12);
    g.fillStyle(0x6b4220).fillRect(2, 7, 12, 2).fillRect(7, 2, 2, 12);
    return { width: 16, height: 16 };
  },
  destructible_concrete: (g) => {
    g.fillStyle(OUTLINE).fillRect(0, 0, 16, 16);
    g.fillStyle(0x9a9a92).fillRect(1, 1, 14, 14);
    g.fillStyle(0x6e6e68).fillRect(4, 3, 1, 5).fillRect(5, 7, 4, 1).fillRect(10, 9, 1, 4);
    return { width: 16, height: 16 };
  },
  destructible_armored: (g) => {
    g.fillStyle(OUTLINE).fillRect(0, 0, 16, 16);
    g.fillStyle(0x4c5560).fillRect(1, 1, 14, 14);
    g.fillStyle(0x8a95a3);
    for (const [x, y] of [
      [3, 3],
      [11, 3],
      [3, 11],
      [11, 11],
    ] as const)
      g.fillRect(x, y, 2, 2);
    return { width: 16, height: 16 };
  },
  muzzle_flash: (g) => {
    g.fillStyle(0xffb030).fillTriangle(0, 0, 10, 4, 0, 8);
    g.fillStyle(0xfff4b0).fillTriangle(0, 2, 6, 4, 0, 6);
    return { width: 10, height: 8 };
  },
  spark: (g) => {
    g.fillStyle(0xfff4b0).fillRect(1, 0, 1, 3).fillRect(0, 1, 3, 1);
    return { width: 3, height: 3 };
  },
  explosion: (g) => {
    g.fillStyle(0xd6453e).fillCircle(16, 16, 16);
    g.fillStyle(0xffb030).fillCircle(15, 15, 11);
    g.fillStyle(0xfff4b0).fillCircle(14, 14, 6);
    return { width: 32, height: 32 };
  },
  impact_puff: (g) => {
    g.fillStyle(0xcfc3a0).fillCircle(4, 4, 4);
    g.fillStyle(0xeee4c8).fillCircle(3, 3, 2);
    return { width: 8, height: 8 };
  },
};

/** Generates the texture for `key` if a drawer exists; returns false otherwise. */
export function generatePlaceholder(scene: Phaser.Scene, key: AssetKey): boolean {
  const draw = drawers[key];
  if (!draw) return false;
  const g = scene.make.graphics({}, false);
  const { width, height } = draw(g);
  g.generateTexture(key, width, height);
  g.destroy();
  return true;
}

export function hasPlaceholder(key: AssetKey): boolean {
  return key in drawers;
}

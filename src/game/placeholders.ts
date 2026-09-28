import type Phaser from 'phaser';
import type { AssetKey } from '../data/assetManifest';

/** Code-drawn stand-ins for manifest entries without a file. All face east (0 rad). */
type Draw = (g: Phaser.GameObjects.Graphics) => { width: number; height: number };

const OUTLINE = 0x1f1f10;
const OLIVE = 0x6b6b3a;
const OLIVE_LIGHT = 0x85854a;
const TRACK = 0x3a3a26;

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
  muzzle_flash: (g) => {
    g.fillStyle(0xffb030).fillTriangle(0, 0, 10, 4, 0, 8);
    g.fillStyle(0xfff4b0).fillTriangle(0, 2, 6, 4, 0, 6);
    return { width: 10, height: 8 };
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

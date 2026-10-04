import type Phaser from 'phaser';
import type { AssetKey } from '../data/assetManifest';

/** Code-drawn stand-ins for manifest entries without a file. All face east (0 rad). */
type Draw = (g: Phaser.GameObjects.Graphics) => { width: number; height: number };

const OUTLINE = 0x1f1f10;
const OLIVE = 0x6b6b3a;
const OLIVE_LIGHT = 0x85854a;
/** Enemies wear rust and brown so they never read as the olive player tank. */
const ENEMY_KHAKI = 0xb07a4a;
const ENEMY_DARK = 0x7a4e2e;

const drawers: Partial<Record<AssetKey, Draw>> = {
  shell_120: (g) => {
    g.fillStyle(0xfff2a8).fillRect(0, 0, 8, 2);
    g.fillStyle(0xffffff).fillRect(5, 0, 3, 2);
    return { width: 8, height: 2 };
  },
  mk_upgrade: (g) => {
    // A big olive crate with a yellow star: the Mk upgrade a boss leaves behind.
    g.fillStyle(OUTLINE).fillRect(0, 0, 20, 20);
    g.fillStyle(OLIVE).fillRect(1, 1, 18, 18);
    g.fillStyle(OLIVE_LIGHT).fillRect(1, 1, 18, 2);
    g.fillStyle(0xf0c040).fillPoints(
      [
        { x: 10, y: 3 },
        { x: 12, y: 8 },
        { x: 17, y: 8 },
        { x: 13, y: 11 },
        { x: 15, y: 16 },
        { x: 10, y: 13 },
        { x: 5, y: 16 },
        { x: 7, y: 11 },
        { x: 3, y: 8 },
        { x: 8, y: 8 },
      ],
      true,
    );
    return { width: 20, height: 20 };
  },
  boss_desert_bunker: (g) => {
    // A squat concrete command bunker seen from above: slab roof, vents, aerials, sandbagged front.
    g.fillStyle(OUTLINE).fillRect(0, 0, 96, 48);
    g.fillStyle(0x9a978c).fillRect(1, 1, 94, 46);
    g.fillStyle(0xb4b1a6).fillRect(1, 1, 94, 3);
    g.fillStyle(0x76736a).fillRect(1, 43, 94, 4);
    g.fillStyle(0x76736a);
    for (let x = 24; x < 96; x += 24) g.fillRect(x, 4, 1, 39);
    // Roof hatches and vents (the mortar's favourite targets).
    g.fillStyle(0x4f4d47).fillRect(10, 12, 8, 8).fillRect(78, 12, 8, 8);
    g.fillStyle(0x2f2e2a).fillRect(40, 10, 16, 4).fillRect(40, 18, 16, 4);
    // Aerials and a radar dish.
    g.fillStyle(OUTLINE).fillRect(6, 30, 1, 10).fillRect(89, 28, 1, 12);
    g.fillStyle(0xc6c4bc).fillCircle(70, 32, 5);
    g.fillStyle(0x76736a).fillCircle(70, 32, 2);
    // Sandbags along the south face.
    g.fillStyle(0x8e7a50).fillRect(4, 40, 88, 6);
    g.fillStyle(0xcbb282);
    for (let x = 5; x < 91; x += 6) g.fillRect(x, 41, 5, 4);
    return { width: 96, height: 48 };
  },
  boss_desert_gun: (g) => {
    // Rail gun on a turntable: pivot at x=10, a long barrel with a muzzle brake to x=40.
    g.fillStyle(OUTLINE).fillRect(14, 5, 26, 6);
    g.fillStyle(ENEMY_DARK).fillRect(15, 6, 24, 4);
    g.fillStyle(OUTLINE).fillRect(34, 3, 6, 10);
    g.fillStyle(ENEMY_KHAKI).fillRect(35, 4, 4, 8);
    g.fillStyle(OUTLINE).fillCircle(10, 8, 8);
    g.fillStyle(ENEMY_KHAKI).fillCircle(10, 8, 7);
    g.fillStyle(ENEMY_DARK).fillRect(5, 4, 8, 8);
    g.fillStyle(0xd6453e).fillRect(8, 7, 2, 2);
    return { width: 40, height: 16 };
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
  shell_mortar: (g) => {
    g.fillStyle(OUTLINE).fillCircle(2, 2, 2);
    g.fillStyle(0x9a9a7a).fillRect(1, 1, 2, 2);
    return { width: 4, height: 4 };
  },
  shadow: (g) => {
    g.fillStyle(0x000000, 0.35).fillEllipse(4, 2, 8, 4);
    return { width: 8, height: 4 };
  },
  pickup: (g) => {
    // Supply crate with a yellow star.
    g.fillStyle(OUTLINE).fillRect(0, 0, 14, 14);
    g.fillStyle(0x8a6a3a).fillRect(1, 1, 12, 12);
    g.fillStyle(0xffd84a).fillTriangle(7, 2, 11, 11, 3, 11).fillTriangle(3, 5, 11, 5, 7, 12);
    return { width: 14, height: 14 };
  },
  depot_pad: (g) => {
    // Concrete pad with a green repair cross.
    g.fillStyle(OUTLINE).fillRect(0, 0, 32, 32);
    g.fillStyle(0x8a8a80).fillRect(1, 1, 30, 30);
    g.fillStyle(0x5a5a52);
    for (let i = 3; i < 30; i += 6) g.fillRect(i, 1, 1, 30);
    g.fillStyle(0x3fae4a).fillRect(13, 7, 6, 18).fillRect(7, 13, 18, 6);
    return { width: 32, height: 32 };
  },
  switch_off: (g) => {
    g.fillStyle(OUTLINE).fillRect(0, 0, 12, 12);
    g.fillStyle(0x5a5a52).fillRect(1, 1, 10, 10);
    g.fillStyle(0xd6453e).fillCircle(6, 6, 3);
    return { width: 12, height: 12 };
  },
  switch_on: (g) => {
    g.fillStyle(OUTLINE).fillRect(0, 0, 12, 12);
    g.fillStyle(0x5a5a52).fillRect(1, 1, 10, 10);
    g.fillStyle(0x4ae05a).fillCircle(6, 6, 3);
    return { width: 12, height: 12 };
  },
  door: (g) => {
    // One 16px tile of a steel blast door; tiled over the door's rect.
    g.fillStyle(OUTLINE).fillRect(0, 0, 16, 16);
    g.fillStyle(0x5e6670).fillRect(1, 1, 14, 14);
    g.fillStyle(0xe0b030).fillRect(1, 6, 14, 2);
    g.fillStyle(OUTLINE).fillRect(1, 7, 14, 1);
    return { width: 16, height: 16 };
  },
  boulder: (g) => {
    g.fillStyle(OUTLINE).fillCircle(8, 8, 8);
    g.fillStyle(0x8a7a64).fillCircle(8, 8, 7);
    g.fillStyle(0xa8977c).fillCircle(6, 6, 3);
    return { width: 16, height: 16 };
  },
  enemy_rifle_soldier: (g) => {
    // Helmet from above, shoulders and a rifle pointing east.
    g.fillStyle(OUTLINE).fillCircle(4, 4, 4);
    g.fillStyle(ENEMY_KHAKI).fillCircle(4, 4, 3);
    g.fillStyle(ENEMY_DARK).fillCircle(4, 4, 2);
    g.fillStyle(OUTLINE).fillRect(5, 5, 5, 1);
    return { width: 10, height: 9 };
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

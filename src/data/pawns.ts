import type { AssetKey } from './assetManifest';
import type { ArmorId } from './combat';
import type { WeaponId } from './weapons';

/** The rear-hatch scout (GAME_DESIGN.md, `hatch_scout`; ARCHITECTURE.md, Pawns). */
export interface ScoutDef {
  hp: number;
  armor: ArmorId;
  /** Walking speed, px/s. */
  speed: number;
  /** Speed while it walks itself back to the tank, px/s. */
  recallSpeed: number;
  bodyRadius: number;
  weapon: WeaponId;
  sprite: AssetKey;
  /** Furthest it may get from the tank, px (keeps the tank's chunk streamed in). */
  leash: number;
  /** Walking back within this distance of the tank boards it, px. */
  boardRadius: number;
  /** The tank must be slower than this to open the hatch, px/s. */
  deploySpeedMax: number;
  /** Seconds before the hatch opens again after the scout went down. */
  deathCooldown: number;
}

export const scout: ScoutDef = {
  hp: 30,
  armor: 'none',
  speed: 70,
  recallSpeed: 110,
  bodyRadius: 4,
  weapon: 'rifle_scout',
  sprite: 'scout',
  leash: 400,
  boardRadius: 22,
  deploySpeedMax: 5,
  deathCooldown: 1.5,
};

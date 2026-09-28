import {
  ammoTypes,
  armorMultipliers,
  REAR_ARC,
  REAR_MULTIPLIER,
  RICOCHET_MULTIPLIER,
  type AmmoType,
  type ArmorId,
  type WeaponClass,
} from '../../data/combat';
import { wrapAngle } from '../input/stick';

/** The parts of a weapon the damage rules read (a `WeaponDef` fits). */
export interface HitWeapon {
  damage: number;
  class: WeaponClass;
  ammo: AmmoType;
}

export interface HitTarget {
  armor: ArmorId;
  /** Hull heading, radians; targets without one (infantry, bunkers' round sides…) have no rear. */
  heading?: number;
}

export interface HitResult {
  damage: number;
  rear: boolean;
  /** The armor shrugged most of it off: show sparks, not a flash. */
  ricochet: boolean;
}

/**
 * A shot travelling at `shotAngle` hits the rear when it's moving the way the target faces, i.e.
 * it came from behind. Inclusive at the arc boundary.
 */
export function isRearHit(targetHeading: number, shotAngle: number): boolean {
  return Math.abs(wrapAngle(shotAngle - targetHeading)) <= REAR_ARC + 1e-9;
}

/** Damage = weapon damage × armor multiplier for its class, ×1.5 in the rear arc (GAME_DESIGN.md). */
export function resolveHit(weapon: HitWeapon, target: HitTarget, shotAngle: number): HitResult {
  const mul = armorMultipliers[target.armor][weapon.class];
  const rear = target.heading !== undefined && isRearHit(target.heading, shotAngle);
  return {
    damage: weapon.damage * mul * (rear ? REAR_MULTIPLIER : 1),
    rear,
    ricochet: mul <= RICOCHET_MULTIPLIER,
  };
}

const ammoRank = (a: AmmoType) => ammoTypes.indexOf(a);

/** Destructibles take full damage from ammo at or above their `minAmmo`, and none below it. */
export function damageMaterial(
  weapon: HitWeapon,
  material: { minAmmo: AmmoType },
): { damage: number; ricochet: boolean } {
  return ammoRank(weapon.ammo) >= ammoRank(material.minAmmo)
    ? { damage: weapon.damage, ricochet: false }
    : { damage: 0, ricochet: true };
}

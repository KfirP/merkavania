import type { WeaponId } from '../../data/weapons';
import type { Owner } from '../combat/faction';

/** The weapon that flips each fire-activated switch kind (LEVEL_DESIGN.md, `switch`). */
const SWITCH_WEAPONS: Readonly<Record<string, readonly WeaponId[]>> = {
  cannon: ['gun_105'],
  mortar: ['mortar_60'],
};

/**
 * Whether a hit from `weapon` flips a switch with this `activatedBy`. Scout and drone switches are
 * flipped by the pawn (M5+), `lahat`/`remote` by the guided missile (later).
 */
export function activates(activatedBy: string, weapon: WeaponId, owner: Owner): boolean {
  return owner === 'player' && (SWITCH_WEAPONS[activatedBy]?.includes(weapon) ?? false);
}

import type { AbilityId, MinorPickupId } from '../../data/abilities';
import { mkTiers, type MkTierId } from '../../data/mkTiers';
import {
  AMMO_RACK_BONUS,
  ARMOR_PLATE_HP,
  REPAIR_KIT_HEAL,
  secondaries,
  secondaryIds,
  type SecondaryId,
} from '../../data/progression';
import { WorldFlags } from './flags';

/**
 * Everything the player has earned (docs/ARCHITECTURE.md, Save system): shared by the scenes and
 * written to a save slot by `logic/save`. The functions below mutate it in place.
 */
export interface GameState {
  mk: MkTierId;
  abilities: AbilityId[];
  minor: Record<MinorPickupId, number>;
  selectedSecondary: SecondaryId;
  /** Rounds left per limited secondary. */
  secondaryAmmo: Partial<Record<SecondaryId, number>>;
  /** `<chunkId>:<id>` of the last depot used; null respawns at `start`. */
  depot: string | null;
  /** Persistent object state: pickups taken, destructibles broken, switches flipped. */
  flags: WorldFlags;
  /** Biome id → chunk ids visited, in visit order. */
  visitedChunks: Record<string, string[]>;
  playtimeMs: number;
  /** Field repairs left (at most one per `repair_kit`); depots refill them. */
  repairCharges: number;
}

export interface PickupGrant {
  /** `<chunkId>:<id>` */
  key: string;
  ability?: AbilityId;
  minor?: MinorPickupId;
}

export function newGame(): GameState {
  return {
    mk: 'mk2',
    abilities: [],
    minor: { armor_plate: 0, ammo_rack: 0, repair_kit: 0 },
    selectedSecondary: 'coax_mg',
    secondaryAmmo: {},
    depot: null,
    flags: new WorldFlags(),
    visitedChunks: {},
    playtimeMs: 0,
    repairCharges: 0,
  };
}

export function hasAbility(s: GameState, ability: AbilityId): boolean {
  return s.abilities.includes(ability);
}

export function maxHp(s: GameState): number {
  return mkTiers[s.mk].hp + s.minor.armor_plate * ARMOR_PLATE_HP;
}

/** Field repair charges when full: one per repair kit. */
export function repairCapacity(s: GameState): number {
  return s.minor.repair_kit;
}

/**
 * Spends a repair charge on a tank at `hp` of `max`; returns the HP it gains, or null (and spends
 * nothing) without a charge, at full HP or when dead.
 */
export function useRepairKit(s: GameState, hp: number, max: number): number | null {
  if (s.repairCharges <= 0 || hp <= 0 || hp >= max) return null;
  s.repairCharges -= 1;
  return Math.min(max - hp, Math.ceil(max * REPAIR_KIT_HEAL));
}

/** Rounds a limited secondary holds when full; null for unlimited ones. */
export function ammoCapacity(s: GameState, id: SecondaryId): number | null {
  const base = secondaries[id].ammo;
  return base === undefined ? null : base + s.minor.ammo_rack * AMMO_RACK_BONUS;
}

export function unlockedSecondaries(s: GameState): SecondaryId[] {
  return secondaryIds.filter((id) => {
    const ability = secondaries[id].ability;
    return !ability || hasAbility(s, ability);
  });
}

/** Gives the tank an ability; a secondary it unlocks comes fully loaded. */
export function grantAbility(s: GameState, ability: AbilityId): void {
  if (hasAbility(s, ability)) return;
  s.abilities.push(ability);
  for (const id of secondaryIds)
    if (secondaries[id].ability === ability) s.secondaryAmmo[id] = ammoCapacity(s, id)!;
}

/** Takes a pickup; false if it was already taken. */
export function collectPickup(s: GameState, pickup: PickupGrant): boolean {
  if (s.flags.has(pickup.key)) return false;
  s.flags.set(pickup.key);
  if (pickup.ability) grantAbility(s, pickup.ability);
  if (pickup.minor) {
    s.minor[pickup.minor] += 1;
    if (pickup.minor === 'repair_kit') s.repairCharges += 1;
    if (pickup.minor === 'ammo_rack')
      for (const id of unlockedSecondaries(s))
        if (s.secondaryAmmo[id] !== undefined) s.secondaryAmmo[id] += AMMO_RACK_BONUS;
  }
  return true;
}

/** Selects the next (`dir` 1) or previous (-1) secondary the tank has. */
export function cycleSecondary(s: GameState, dir: 1 | -1): void {
  const list = unlockedSecondaries(s);
  const i = Math.max(0, list.indexOf(s.selectedSecondary));
  s.selectedSecondary = list[(i + dir + list.length) % list.length]!;
}

/** Uses one round; false if the secondary is locked or empty. */
export function spendAmmo(s: GameState, id: SecondaryId): boolean {
  if (!unlockedSecondaries(s).includes(id)) return false;
  if (ammoCapacity(s, id) === null) return true;
  const left = s.secondaryAmmo[id] ?? 0;
  if (left <= 0) return false;
  s.secondaryAmmo[id] = left - 1;
  return true;
}

/** A repair depot: it becomes the respawn point and refills every limited secondary. */
export function useDepot(s: GameState, key: string): void {
  s.depot = key;
  s.repairCharges = repairCapacity(s);
  for (const id of unlockedSecondaries(s)) {
    const cap = ammoCapacity(s, id);
    if (cap !== null) s.secondaryAmmo[id] = cap;
  }
}

export function visitChunk(s: GameState, biome: string, chunkId: string): void {
  const list = (s.visitedChunks[biome] ??= []);
  if (!list.includes(chunkId)) list.push(chunkId);
}

import { abilityIds, minorPickupIds, type AbilityId } from '../../data/abilities';
import { mkTiers, type MkTierId } from '../../data/mkTiers';
import { isSecondaryId, secondaryIds, type SecondaryId } from '../../data/progression';
import { WorldFlags } from '../state/flags';
import { newGame, type GameState } from '../state/gameState';
import { migrate, migrations } from './migrations';

/**
 * Versioned saves in localStorage (docs/ARCHITECTURE.md, Save system). Bump SAVE_VERSION and add a
 * migration whenever `SaveData` changes.
 */
export const SAVE_VERSION = 1;
export const SLOTS = [1, 2, 3] as const;

export interface SaveData {
  version: number;
  updatedAt: number;
  playtimeMs: number;
  mk: MkTierId;
  abilities: AbilityId[];
  minor: GameState['minor'];
  selectedSecondary: SecondaryId;
  secondaryAmmo: Partial<Record<SecondaryId, number>>;
  depotId: string | null;
  flags: Record<string, boolean | number>;
  visitedChunks: Record<string, string[]>;
}

export function serialize(s: GameState, now: number): SaveData {
  return {
    version: SAVE_VERSION,
    updatedAt: now,
    playtimeMs: s.playtimeMs,
    mk: s.mk,
    abilities: [...s.abilities],
    minor: { ...s.minor },
    selectedSecondary: s.selectedSecondary,
    secondaryAmmo: { ...s.secondaryAmmo },
    depotId: s.depot,
    flags: Object.fromEntries(s.flags.toJSON().map((k) => [k, true])),
    visitedChunks: Object.fromEntries(
      Object.entries(s.visitedChunks).map(([biome, ids]) => [biome, [...ids]]),
    ),
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : 0);

/**
 * A stored save → GameState, migrating older versions. Returns null for anything unreadable
 * (never throws into the game); unknown ids are dropped rather than failing the whole save.
 */
export function deserialize(raw: unknown): GameState | null {
  if (!isRecord(raw)) return null;
  const data = migrate(raw, migrations, SAVE_VERSION);
  if (!data) return null;
  if (typeof data.mk !== 'string' || !Object.hasOwn(mkTiers, data.mk)) return null;
  if (!Array.isArray(data.abilities) || !isRecord(data.flags) || !isRecord(data.minor)) return null;

  const s = newGame();
  s.mk = data.mk as MkTierId;
  s.abilities = abilityIds.filter((id) => (data.abilities as unknown[]).includes(id));
  for (const id of minorPickupIds) s.minor[id] = count(data.minor[id]);
  if (isSecondaryId(data.selectedSecondary)) s.selectedSecondary = data.selectedSecondary;
  if (isRecord(data.secondaryAmmo))
    for (const id of secondaryIds)
      if (data.secondaryAmmo[id] !== undefined) s.secondaryAmmo[id] = count(data.secondaryAmmo[id]);
  s.depot = typeof data.depotId === 'string' ? data.depotId : null;
  const flags = data.flags;
  s.flags = new WorldFlags(Object.keys(flags).filter((k) => flags[k]));
  if (isRecord(data.visitedChunks))
    for (const [biome, ids] of Object.entries(data.visitedChunks))
      if (Array.isArray(ids)) s.visitedChunks[biome] = ids.filter((i) => typeof i === 'string');
  s.playtimeMs = count(data.playtimeMs);
  return s;
}

export function slotKey(slot: number): string {
  if (!SLOTS.includes(slot as never)) throw new Error(`No save slot ${slot}`);
  return `merkavania.save.${slot}`;
}

/** The part of `Storage` saves use, so tests can pass a fake. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Reads and writes slots; storage errors (private mode, quota) never reach the game. */
export class SaveStore {
  constructor(
    private readonly storage: StorageLike,
    private readonly now: () => number = Date.now,
  ) {}

  load(slot: number): GameState | null {
    const raw = this.read(slot);
    return raw === null ? null : deserialize(raw);
  }

  /** For the slot list: when it was saved and how long it's been played; null if empty. */
  info(slot: number): { updatedAt: number; playtimeMs: number } | null {
    const raw = this.read(slot);
    if (!isRecord(raw) || deserialize(raw) === null) return null;
    return { updatedAt: count(raw.updatedAt), playtimeMs: count(raw.playtimeMs) };
  }

  /** False if the storage refused the write. */
  save(slot: number, s: GameState): boolean {
    try {
      this.storage.setItem(slotKey(slot), JSON.stringify(serialize(s, this.now())));
      return true;
    } catch {
      return false;
    }
  }

  clear(slot: number): void {
    try {
      this.storage.removeItem(slotKey(slot));
    } catch {
      // nothing stored to clear
    }
  }

  private read(slot: number): unknown {
    try {
      const text = this.storage.getItem(slotKey(slot));
      return text === null ? null : (JSON.parse(text) as unknown);
    } catch {
      return null;
    }
  }
}

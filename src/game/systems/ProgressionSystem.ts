import type { AbilityId } from '../../data/abilities';
import { ARMOR_PLATE_HP, type SecondaryId } from '../../data/progression';
import {
  SaveStore,
  serialize,
  SLOTS,
  type SaveData,
  type StorageLike,
} from '../../logic/save/save';
import {
  ammoCapacity,
  collectPickup,
  cycleSecondary,
  grantAbility,
  hasAbility,
  maxHp,
  newGame,
  spendAmmo,
  unlockedSecondaries,
  useDepot,
  visitChunk,
  type GameState,
} from '../../logic/state/gameState';
import type { PickupSpec } from '../../logic/world/objects';
import { events, type Loadout } from '../events';

/** localStorage, or a throwaway in-memory store where it's blocked (private mode, sandboxes). */
function browserStorage(): StorageLike {
  try {
    const probe = 'merkavania.probe';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => void mem.set(k, v),
      removeItem: (k) => void mem.delete(k),
    };
  }
}

/** Save slot from `?slot=N` (1–3); slot select arrives with the title screen in M6. */
export function slotFromUrl(): number {
  const n = Number(new URLSearchParams(window.location.search).get('slot') ?? 1);
  return SLOTS.includes(n as never) ? n : 1;
}

/**
 * The shared GameState and its save slot (docs/ARCHITECTURE.md, Save system). The rules live in
 * logic/state; this applies them, saves when they say so (pickups, depots) and tells the other
 * scenes through the event bus.
 */
export class ProgressionSystem {
  readonly state: GameState;
  private readonly store: SaveStore;

  constructor(
    readonly slot: number,
    storage: StorageLike = browserStorage(),
  ) {
    this.store = new SaveStore(storage);
    this.state = this.store.load(slot) ?? newGame();
  }

  get maxHp(): number {
    return maxHp(this.state);
  }

  has(ability: AbilityId): boolean {
    return hasAbility(this.state, ability);
  }

  /**
   * Takes a pickup and saves (pickups are kept even if you die before a depot). Returns the extra
   * max HP it gave, or null if it was already taken.
   */
  collect(spec: PickupSpec): { hpBonus: number } | null {
    const grant = { key: spec.key, ability: spec.ability, minor: spec.minor };
    if (!collectPickup(this.state, grant)) return null;
    this.save();
    events.emit('pickup:collected', grant);
    this.emitLoadout();
    if (grant.ability) this.emitAbilities();
    return { hpBonus: spec.minor === 'armor_plate' ? ARMOR_PLATE_HP : 0 };
  }

  /** Rearms, makes it the respawn point and saves. */
  depot(key: string): void {
    useDepot(this.state, key);
    const saved = this.save();
    events.emit('depot:used', { key, saved });
    this.emitLoadout();
  }

  selected(): SecondaryId {
    return this.state.selectedSecondary;
  }

  cycle(dir: 1 | -1): void {
    const before = this.state.selectedSecondary;
    cycleSecondary(this.state, dir);
    if (this.state.selectedSecondary !== before) this.emitLoadout();
  }

  /** Uses a round of `id`; false when it's locked or empty. */
  spend(id: SecondaryId): boolean {
    const ok = spendAmmo(this.state, id);
    if (ok && ammoCapacity(this.state, id) !== null) this.emitLoadout();
    return ok;
  }

  tick(ms: number): void {
    this.state.playtimeMs += ms;
  }

  visit(biome: string, chunkId: string): void {
    visitChunk(this.state, biome, chunkId);
  }

  /** Debug: grants an ability without a pickup (saved with the next save). */
  grant(ability: AbilityId): void {
    grantAbility(this.state, ability);
    this.emitLoadout();
    this.emitAbilities();
  }

  emitAbilities(): void {
    events.emit('abilities:changed', { abilities: [...this.state.abilities] });
  }

  save(): boolean {
    return this.store.save(this.slot, this.state);
  }

  snapshot(): SaveData {
    return serialize(this.state, Date.now());
  }

  loadout(): Loadout {
    const s = this.state;
    const selected = s.selectedSecondary;
    const capacity = ammoCapacity(s, selected);
    return {
      selected,
      unlocked: unlockedSecondaries(s),
      ammo: capacity === null ? null : (s.secondaryAmmo[selected] ?? 0),
      capacity,
      rounds: { ...s.secondaryAmmo },
    };
  }

  emitLoadout(): void {
    events.emit('loadout:changed', this.loadout());
  }
}

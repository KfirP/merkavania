import type Phaser from 'phaser';
import type { ArmorId } from '../../data/combat';
import type { MaterialDef } from '../../data/materials';
import type { Faction } from '../../logic/combat/faction';

/** How a target resists hits: armor (with a hull heading for the rear arc) or a material. */
export type Defense =
  | { armor: ArmorId; heading?: number; weakTo?: Partial<Record<string, number>> }
  | { material: MaterialDef };

/**
 * Anything CombatSystem can hurt: the tank, enemies, destructibles. CombatSystem resolves the
 * damage (docs/ARCHITECTURE.md, Combat flow); the entity only reacts to it.
 */
export interface Damageable {
  /** `player`, an enemy id or a destructible's `<chunkId>:<id>`. */
  readonly combatId: string;
  readonly faction: Faction;
  readonly level: number;
  readonly alive: boolean;
  hp: number;
  readonly maxHp: number;
  readonly defense: Defense;
  /** Centre used for splash distance and effects. */
  readonly pos: { x: number; y: number };
  /** Half-size of a big target (a boss): splash reaches it at its edge, not its centre. */
  readonly halfExtent?: { w: number; h: number };
  /** Sprites that flash white when hit. */
  readonly flashTargets: readonly Phaser.GameObjects.Components.Tint[];
  /** HP reached 0. */
  die(): void;
}

export function isDamageable(o: unknown): o is Damageable {
  return typeof o === 'object' && o !== null && 'combatId' in o && 'defense' in o;
}

/** Who shot, and who can be shot. Destructibles are `neutral`: anyone's fire breaks them. */
export type Faction = 'player' | 'enemy' | 'neutral';
export type Owner = Exclude<Faction, 'neutral'>;

/**
 * Whether a shot may hit a target: never its own side, and only on the same elevation level
 * (docs/ARCHITECTURE.md, Elevation). Mortar shells will bypass the level check in M4.
 */
export function canHit(
  shot: { owner: Owner; level: number },
  target: { faction: Faction; level: number },
): boolean {
  return shot.owner !== target.faction && shot.level === target.level;
}

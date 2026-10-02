/**
 * Persistent world state keyed `<chunkId>:<objectId>`: pickups taken, destructibles broken and
 * switches flipped. Part of the saved GameState.
 */
export class WorldFlags {
  private readonly keys: Set<string>;

  constructor(keys: Iterable<string> = []) {
    this.keys = new Set(keys);
  }

  has(key: string): boolean {
    return this.keys.has(key);
  }

  set(key: string): void {
    this.keys.add(key);
  }

  toJSON(): string[] {
    return [...this.keys];
  }
}

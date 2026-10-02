/**
 * Save migrations (docs/ARCHITECTURE.md, Save system). `migrations[n]` turns a version-n save into
 * a version n+1 save. Any change to the save shape bumps SAVE_VERSION and adds a step here, with a
 * test that migrates a fixture of the old save.
 */

export type Migration = (old: Record<string, unknown>) => Record<string, unknown>;
export type Migrations = Readonly<Record<number, Migration>>;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const migrations: Migrations = {
  /** v2 added repair kit charges: every kit owned starts charged. */
  1: (old) => {
    const kits = isRecord(old.minor) ? old.minor.repair_kit : undefined;
    return {
      ...old,
      repairCharges: Number.isInteger(kits) && (kits as number) > 0 ? (kits as number) : 0,
    };
  },
};

/** Brings a stored save up to `target`; null if it's newer or a step is missing. */
export function migrate(
  data: Record<string, unknown>,
  steps: Migrations,
  target: number,
): Record<string, unknown> | null {
  let current = data;
  let version = Number(current.version);
  if (!Number.isInteger(version) || version > target) return null;
  while (version < target) {
    const step = steps[version];
    if (!step) return null;
    current = { ...step(current), version: version + 1 };
    version += 1;
  }
  return current;
}

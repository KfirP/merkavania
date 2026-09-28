/** HP after `damage`, clamped at 0. `killed` is true only on the hit that takes it to 0. */
export function applyDamage(hp: number, damage: number): { hp: number; killed: boolean } {
  if (damage <= 0 || hp <= 0) return { hp: Math.max(0, hp), killed: false };
  const next = Math.max(0, hp - damage);
  return { hp: next, killed: next === 0 };
}

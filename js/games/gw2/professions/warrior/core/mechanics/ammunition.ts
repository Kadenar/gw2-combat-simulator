import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { WarriorSkill } from '#gw2/professions/warrior/types.js';

// Trait observers and skill variants share immutable acceptance facts before live ammo changes.
export const warriorAmmunition = new WeakMap<RuntimeCast<WarriorSkill>, { rounds: number; startedFull: boolean }>();

/** Reserve all available rounds now; shared commitment spends only the final reserved round. */
export function spendWarriorMagazine(runtime: Gw2Runtime, cast: RuntimeCast<WarriorSkill>): void {
  const ammo = runtime.ammo.get(cast.skill.id);
  warriorAmmunition.set(cast, {
    rounds: Math.max(1, ammo?.charges ?? 1),
    startedFull: Boolean(ammo && ammo.charges >= ammo.maximum)
  });
  if (ammo && ammo.charges > 1) ammo.charges = 1;
}

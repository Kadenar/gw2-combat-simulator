import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { WarriorSkill } from '#gw2/professions/warrior/types.js';

// Trait observers and skill variants share immutable acceptance facts before live ammo changes.
export const warriorAmmunition = new WeakMap<RuntimeCast<WarriorSkill>, { rounds: number; startedFull: boolean }>();

/** Reserve every spent round so the shared ammo queue recovers the magazine one charge at a time. */
export function spendWarriorMagazine(runtime: MechanicContext, cast: RuntimeCast<WarriorSkill>): void {
  const ammo = runtime.cooldownController.readAmmo(cast.skill.id);
  warriorAmmunition.set(cast, {
    rounds: Math.max(1, ammo?.charges ?? 1),
    startedFull: Boolean(ammo && ammo.charges >= ammo.maximum)
  });
  const extraRounds = Math.max(0, (ammo?.charges ?? 1) - 1);
  if (extraRounds)
    runtime.cooldownController.reserveAmmo(cast.skill, extraRounds, {
      startedAt: cast.rechargeStart,
      work: cast.rechargeWork
    });
}

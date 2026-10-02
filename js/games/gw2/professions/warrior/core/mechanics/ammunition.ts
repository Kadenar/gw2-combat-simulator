import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { WarriorSkill } from '#gw2/professions/warrior/types.js';

// Trait observers and skill variants share immutable acceptance facts before live ammo changes.
export const warriorAmmunition = new WeakMap<RuntimeCast<WarriorSkill>, { rounds: number; startedFull: boolean }>();

/** Reserve every spent round so the shared ammo queue recovers the magazine one charge at a time. */
export function spendWarriorMagazine(runtime: Gw2Runtime, cast: RuntimeCast<WarriorSkill>): void {
  const ammo = runtime.ammo.get(cast.skill.id);
  warriorAmmunition.set(cast, {
    rounds: Math.max(1, ammo?.charges ?? 1),
    startedFull: Boolean(ammo && ammo.charges >= ammo.maximum)
  });
  const extraRounds = Math.max(0, (ammo?.charges ?? 1) - 1);
  if (ammo && extraRounds) {
    ammo.charges -= extraRounds;
    for (let index = 0; index < extraRounds; index++)
      ammo.recharges.push({ startedAt: cast.rechargeStart, work: cast.rechargeWork });
    // Reserve future recharge anchors without advancing the other timers beyond the live clock.
    runtime.cooldownController.refreshAmmo(cast.skill, runtime.time);
  }
}

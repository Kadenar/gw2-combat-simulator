import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import { gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';
import type { SchedulerRunResult } from '#gw2/platform/execution/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ProfessionContract, Gw2SimulationPlanningState } from '#gw2/platform/simulation/types.js';

/** Projects scheduler-owned state at its planning boundary without borrowing resolver state. */
export function planningState(
  profession: Gw2ProfessionContract,
  scheduled: SchedulerRunResult
): Gw2SimulationPlanningState {
  // Planning describes the completed schedule, even when combat ended earlier.
  // Never mix resolver-owned effects at death into this later prediction.
  const endTime = scheduled.state.time;
  const skillName = (id: SkillId): string => profession.catalog?.skillsById?.get(id)?.name || String(id);
  const cooldowns = Object.fromEntries(
    [...scheduled.state.cooldowns].map(([id, readyAt]) => [
      skillName(id),
      {
        readyAt: Math.round(gw2CooldownReadyAt(readyAt) * 1000),
        remaining: Math.max(0, Math.round((gw2CooldownReadyAt(readyAt) - endTime) * 1000))
      }
    ])
  );
  // UI deadlines report the detection tick while the scheduler retains unrounded recharge progress.
  const ammoEntries = [...scheduled.state.ammo].map(
    ([id, value]) =>
      [
        id,
        {
          charges: value.charges,
          maximum: value.maximum,
          rechargeWork: value.rechargeWork,
          nextRechargeAt: value.nextRechargeAt == null ? null : gw2CooldownReadyAt(value.nextRechargeAt),
          ...(value.lockoutReadyAt == null ? {} : { lockoutReadyAt: gw2CooldownReadyAt(value.lockoutReadyAt) })
        }
      ] as const
  );
  const ammo = Object.fromEntries(ammoEntries.map(([id, value]) => [skillName(id), value]));
  // Preserve exact skill identities for UI consumers because API variants can share names.
  const ammoBySkillId = Object.fromEntries(ammoEntries.map(([id, value]) => [String(id), structuredClone(value)]));
  // Profession projections receive only scheduler-owned inputs.
  const projected = profession.projectPlanningState({
    schedulerContext: scheduled.context,
    schedulerState: scheduled.state
  });
  return {
    atSeconds: endTime,
    cooldowns,
    ammo,
    ammoBySkillId,
    activeWeaponSet: scheduled.state.activeWeaponSet,
    // Projection lets a profession hide resolver-only bookkeeping.
    profession: {
      ...structuredClone(projected ?? flattenProfessionState(scheduled.state.profession)),
      // Capacity is policy-derived reporting data, never duplicated in mutable profession state.
      ...(profession.resources.endurance
        ? { maximumEndurance: profession.resources.endurance.maximum(scheduled.context) }
        : {})
    }
  };
}

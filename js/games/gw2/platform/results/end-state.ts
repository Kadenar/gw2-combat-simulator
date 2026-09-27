import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import { gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';
import type { AmmoState } from '#gw2/platform/execution/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2PlanningStateInput, Gw2SimulationPlanningState } from '#gw2/platform/simulation/types.js';

/** Projects one observed boundary into detached public fields, without access to execution controllers or history. */
export function planningState<T extends object>(
  input: Gw2PlanningStateInput<T> & {
    readonly cooldowns: ReadonlyMap<SkillId, number>;
    readonly ammo: ReadonlyMap<SkillId, AmmoState>;
  },
  project?: (input: Gw2PlanningStateInput<T>) => unknown,
  maximumEndurance?: number
): Gw2SimulationPlanningState {
  const endTime = input.time;
  const skillName = (id: SkillId): string => input.catalog.skillsById.get(id)?.name || String(id);
  const cooldowns = Object.fromEntries(
    [...input.cooldowns].map(([id, readyAt]) => [
      skillName(id),
      {
        readyAt: Math.round(gw2CooldownReadyAt(readyAt) * 1000),
        remaining: Math.max(0, Math.round((gw2CooldownReadyAt(readyAt) - endTime) * 1000))
      }
    ])
  );
  // UI deadlines report the detection tick while execution retains unrounded recharge progress.
  const ammoEntries = [...input.ammo].map(
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
  const projected = project?.({
    profession: input.profession,
    time: input.time,
    activeWeaponSet: input.activeWeaponSet,
    config: input.config,
    catalog: input.catalog
  });
  return {
    atSeconds: endTime,
    cooldowns,
    ammo,
    ammoBySkillId,
    activeWeaponSet: input.activeWeaponSet,
    // Projection lets a profession hide its internal bookkeeping.
    profession: {
      ...structuredClone(projected ?? flattenProfessionState(input.profession)),
      // Capacity is policy-derived reporting data, never duplicated in mutable profession state.
      ...(maximumEndurance == null ? {} : { maximumEndurance })
    }
  };
}

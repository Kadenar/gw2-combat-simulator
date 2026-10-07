import type { EffectState } from '#gw2/platform/combat/effect-state.js';
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import type { CooldownController } from '#gw2/platform/execution/cooldown-contracts.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { flattenProfessionState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput, Gw2SimulationPlanningState } from '#gw2/platform/results/types.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Projects one observed boundary into detached public fields, using only recharge observations and profession data. */
export function planningState<T extends object>(
  input: Gw2PlanningStateInput<T> & {
    readonly cooldownController: Pick<CooldownController, 'cooldownSkillIds' | 'readyAt' | 'ammoSkillIds' | 'readAmmo'>;
  },
  project: ((input: Gw2PlanningStateInput<T>) => unknown) | undefined,
  availability: (skill: Skill) => AvailabilityResult,
  effects: readonly EffectState[]
): Gw2SimulationPlanningState {
  const endTime = input.time;
  // Keep distinct skills separate even when their display names match.
  const cooldowns = Object.fromEntries(
    [...input.cooldownController.cooldownSkillIds()].map((id) => {
      const readyAt = input.cooldownController.readyAt(id)!;
      return [
        String(id),
        {
          readyAt: Math.round(gw2CooldownReadyAt(readyAt) * 1000),
          remaining: Math.max(0, Math.round((gw2CooldownReadyAt(readyAt) - endTime) * 1000))
        }
      ];
    })
  );
  // Publish detached display facts; execution keeps recharge work and lockouts, and UI deadlines use the detection tick.
  const ammoEntries = [...input.cooldownController.ammoSkillIds()].map((id) => {
    const value = input.cooldownController.readAmmo(id)!;
    return [
      id,
      {
        charges: value.charges,
        maximum: value.maximum,
        nextRechargeAt: value.nextRechargeAt == null ? null : gw2CooldownReadyAt(value.nextRechargeAt)
      }
    ] as const;
  });
  const ammoBySkillId = Object.fromEntries(ammoEntries);
  const projected = project?.({
    profession: input.profession,
    time: input.time,
    activeWeaponSet: input.activeWeaponSet,
    config: input.config,
    catalog: input.catalog
  });
  return {
    // Query every castable candidate while the runtime exists, then detach the verdicts with the observation.
    availability: structuredClone(
      Object.fromEntries(
        input.catalog.skills
          .filter((skill) => !skill.simulatorExcluded && !skill.initialStateOnly)
          .map((skill) => [String(skill.id), availability(skill)])
      )
    ),
    effects: structuredClone(effects),
    atSeconds: endTime,
    cooldowns,
    ammoBySkillId,
    activeWeaponSet: input.activeWeaponSet,
    // Projection lets a profession hide its internal bookkeeping.
    profession: structuredClone(projected ?? flattenProfessionState(input.profession))
  };
}

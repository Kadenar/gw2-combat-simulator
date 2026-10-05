import { preparednessCapacityField } from '#gw2/professions/thief/core/traits/resource-queries.js';

import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';
import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';

import type { ThiefConfig, ThiefSkill } from '#gw2/professions/thief/types.js';

/** Initiative regeneration: the selected base rate plus the kneeling bonus while kneeling. */
export function thiefInitiativeRegenerationRate(state: Pick<ThiefCoreState, 'kneeling'>, context: unknown): number {
  const profile = requireBalanceProfileFromContext(context, PROFILE.resources);
  return (
    balanceProfileNumber(profile, 'resourceGain') +
    (state.kneeling ? balanceProfileNumber(profile, 'kneelingInitiativeRegenerationBonus') : 0)
  );
}

/** Initiative shares the platform lifecycle while kneeling and Preparedness remain Thief rules. */
export const thiefInitiative: ResourcePolicy<ThiefRuntime> = {
  kind: 'continuous',
  state: (runtime) => runtime.profession.core.initiative,
  maximum: (runtime) =>
    balanceProfileNumber(
      requireBalanceProfileFromContext(runtime, PROFILE.resources),
      preparednessCapacityField(runtime)
    ),
  initial: (runtime) => (runtime.config as ThiefConfig).initialInitiative ?? 12,
  recovery: (runtime) => thiefInitiativeRegenerationRate(runtime.profession.core, runtime),
  // Besides regeneration, the pending signet pulse and the running cast's completion are the known grant boundaries.
  nextChange(runtime, cost) {
    if (cost > runtime.profession.core.initiative.maximum) return Infinity;
    const pulse = runtime.profession.core.infiltratorsSignetPulseAt;
    const completion = runtime.castController.currentLaneEnd();
    return Math.min(
      pulse != null && pulse > runtime.time ? pulse : Infinity,
      completion > runtime.time ? completion : Infinity
    );
  }
};

/** Vigor multiplies regeneration up to the selected cap; specializations may replace only the capacity. */
function thiefEnduranceRate(runtime: ThiefRuntime, vigor: boolean): number {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.resources);
  return Math.min(
    balanceProfileNumber(profile, 'threshold'),
    balanceProfileNumber(profile, 'enduranceRegenerationPerSecond') *
      (vigor ? balanceProfileNumber(profile, 'vigorRegenerationMultiplier') : 1)
  );
}

export const thiefEndurance: EndurancePolicy<ThiefRuntime> = {
  state: (runtime) => runtime.profession.core.endurance,
  maximum: () => 100,
  regenerationRate: (runtime, vigor) => thiefEnduranceRate(runtime, vigor)
};

/** Kneeling changes the regeneration rate from this instant onward. */
export function setThiefKneeling(runtime: ThiefRuntime, kneeling: boolean): void {
  runtime.profession.core.kneeling = kneeling;
  runtime.resourceController.refresh('initiative');
}

/** Initiative costs are paid when the cast is accepted. */
export function spendThiefCoreResources(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const skill = cast.skill as { initiativeCost?: number };
  const cost = skill.initiativeCost || 0;
  if (cost > 0) runtime.resourceController.spend('initiative', cost);
}

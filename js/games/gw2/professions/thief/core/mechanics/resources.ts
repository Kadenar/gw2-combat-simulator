import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { preparednessCapacityField } from '#gw2/professions/thief/core/traits/resource-queries.js';
import { canonicalTime, EPSILON } from '#kernel/core/clock.js';

import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';
import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefConfig, ThiefSkill } from '#gw2/professions/thief/types.js';

export const THIEF_INFILTRATORS_SIGNET_PULSE = 'thief.infiltrators-signet';

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

/**
 * Infiltrator's Signet pulses ten seconds after it last became ready. Each restart owns the next pulse instant, so an
 * earlier pulse still in the queue retires itself instead of being cancelled.
 */
export function restartThiefInfiltratorsSignet(runtime: ThiefRuntime): void {
  const core = runtime.profession.core;
  if (!selectedSkillIdSet(runtime.config.selectedSkillIds).has(ID.INFILTRATORS_SIGNET)) return;
  const at = canonicalTime(
    Math.max(runtime.time, runtime.cooldownController.readyAt(ID.INFILTRATORS_SIGNET) || 0) + 10
  );
  core.infiltratorsSignetPulseAt = at;
  runtime.schedule(THIEF_INFILTRATORS_SIGNET_PULSE, at, { at });
}

/** Grants one initiative while the signet is off cooldown, then schedules the next pulse. */
export function thiefInfiltratorsSignetPulse(runtime: ThiefRuntime, data: unknown): void {
  const core = runtime.profession.core;
  if ((data as { at: number }).at !== core.infiltratorsSignetPulseAt) return;
  if ((runtime.cooldownController.readyAt(ID.INFILTRATORS_SIGNET) || 0) <= runtime.time + EPSILON)
    runtime.resourceController.grant('initiative', 1);
  restartThiefInfiltratorsSignet(runtime);
}

/** Initiative costs are paid when the cast is accepted. */
export function spendThiefCoreResources(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const skill = cast.skill as { initiativeCost?: number };
  const cost = skill.initiativeCost || 0;
  if (cost > 0) runtime.resourceController.spend('initiative', cost);
}

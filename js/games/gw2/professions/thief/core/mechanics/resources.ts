import { canonicalTime, EPSILON } from '#kernel/core/clock.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { castRelativeEffectTimingScale } from '#gw2/platform/skills/timing.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';
import type { ThiefConfig } from '#gw2/professions/thief/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';

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
      hasTrait(runtime, TRAIT.PREPAREDNESS) ? 'minimumStacks' : 'maximumStacks'
    ),
  initial: (runtime) => Number((runtime.config as ThiefConfig).initialInitiative ?? 12),
  recovery: (runtime) => thiefInitiativeRegenerationRate(runtime.profession.core, runtime),
  // Besides regeneration, the pending signet pulse and the running cast's completion are the known grant boundaries.
  nextChange(runtime, cost) {
    if (cost > runtime.profession.core.initiative.maximum) return Infinity;
    const pulse = runtime.profession.core.infiltratorsSignetPulseAt;
    const completion = runtime.cursor.endTime();
    return Math.min(
      pulse != null && pulse > runtime.time ? pulse : Infinity,
      completion > runtime.time ? completion : Infinity
    );
  }
};

/** Vigor multiplies regeneration up to the selected cap; specializations may replace only the capacity. */
export function thiefEnduranceRate(runtime: ThiefRuntime, vigor: boolean): number {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.resources);
  return Math.min(
    balanceProfileNumber(profile, 'threshold'),
    balanceProfileNumber(profile, 'enduranceRegenerationPerSecond') *
      (vigor ? balanceProfileNumber(profile, 'vigorRegenerationMultiplier') : 1)
  );
}

export const thiefEndurance: EndurancePolicy<ThiefRuntime> = {
  state: (runtime) => runtime.profession.core,
  maximum: () => 100,
  regenerationRate: (runtime, vigor) => thiefEnduranceRate(runtime, vigor)
};

/** Grants initiative at the live clock; the shared controller settles regeneration first. */
export function grantThiefInitiative(runtime: ThiefRuntime, amount: number): void {
  if (Number(amount) > 0) runtime.resourceController.grant('initiative', Number(amount));
}

/** Grants endurance at the live clock, capped by the active specialization's pool. */
export function grantThiefEndurance(runtime: ThiefRuntime, amount: number): void {
  if (Number(amount) > 0) runtime.endurance.grant(Number(amount));
}

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
  if (!selectedSkillNameSet(runtime.config.selectedSkills).has("Infiltrator's Signet")) return;
  const at = canonicalTime(Math.max(runtime.time, Number(runtime.cooldowns.get(ID.INFILTRATORS_SIGNET) || 0)) + 10);
  core.infiltratorsSignetPulseAt = at;
  runtime.schedule(THIEF_INFILTRATORS_SIGNET_PULSE, at, { at });
}

/** Grants one initiative while the signet is off cooldown, then schedules the next pulse. */
export function thiefInfiltratorsSignetPulse(runtime: ThiefRuntime, data: unknown): void {
  const core = runtime.profession.core;
  if ((data as { at: number }).at !== core.infiltratorsSignetPulseAt) return;
  if (Number(runtime.cooldowns.get(ID.INFILTRATORS_SIGNET) || 0) <= runtime.time + EPSILON)
    grantThiefInitiative(runtime, 1);
  restartThiefInfiltratorsSignet(runtime);
}

/** Initiative costs and Signets of Power's refund are paid when the cast is accepted. */
export function spendThiefCoreResources(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const skill = cast.skill as { initiativeCost?: number; categories?: readonly string[] };
  const cost = Number(skill.initiativeCost || 0);
  if (cost > 0) runtime.resourceController.spend('initiative', cost);
  if (
    (skill.categories || []).some((category) => String(category).toLowerCase().includes('signet')) &&
    hasTrait(runtime, TRAIT.SIGNETS_OF_POWER)
  )
    grantThiefInitiative(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.signetsOfPower), 'resourceGain')
    );
}

/** Signet restarts, Signet of Agility, and Unload's refund apply at the actual completion. */
export function completeThiefCoreResources(runtime: ThiefRuntime, cast: RuntimeCast, committed: boolean): void {
  const skill = cast.skill;
  if (skill.id === ID.INFILTRATORS_SIGNET) {
    restartThiefInfiltratorsSignet(runtime);
    return;
  }

  if (skill.id === ID.SIGNET_OF_AGILITY) {
    grantThiefEndurance(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.signetOfAgility), 'resourceGain')
    );
    return;
  }

  // An interruption before the final bullet cannot award Unload's on-completion refund.
  if (skill.id !== ID.UNLOAD || !committed) return;
  const bullets = skill.effects?.find((effect) => effect.type === 'strike' && effect.name === 'Unload');
  if (bullets?.type !== 'strike') return;
  const finalBulletOffsetMs = Number(bullets.ticks?.at(-1)?.atMs);
  if (!Number.isFinite(finalBulletOffsetMs)) return;
  const timingScale =
    bullets.timingScale === 'cast' ? castRelativeEffectTimingScale(skill, (cast.fullEnd - cast.start) * 1000) : 1;
  if (cast.effectiveEnd + EPSILON < cast.start + (finalBulletOffsetMs * timingScale) / 1000) return;
  grantThiefInitiative(
    runtime,
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.unloadRefund), 'resourceGain')
  );
}

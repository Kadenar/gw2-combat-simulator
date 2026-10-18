import { claimActivation } from '#gw2/platform/combat/procs/activation-claims.js';
import { resourceAtLeast } from '#gw2/platform/combat/resources/pool.js';
import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/skills/balance-profiles.js';
import { burstCompleted, burstFirstHit } from '#gw2/professions/warrior/core/mechanics/trigger-points.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import { warriorBurstRules } from '#gw2/professions/warrior/resource-rules.js';
import type { WarriorRuntime, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

// Immutable reservation facts survive resource changes during the cast.
const warriorBurstSpends = new WeakMap<RuntimeCast<WarriorSkill>, number>();

/** Tier-dependent packets and fields use the same activation-time resource thresholds. */
export function warriorBurstTier(runtime: MechanicQueriesOf<MechanicContext>, spent: number): number {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.burstTiers);
  return spent >= balanceProfileNumber(profile, 'maximumStacks')
    ? 3
    : spent >= balanceProfileNumber(profile, 'threshold')
      ? 2
      : 1;
}

/** Adrenaline has no passive rate; readiness retries only at an actual future Signet of Rage pulse. */
export const coreAdrenalinePolicy: ResourcePolicy<WarriorRuntime> = {
  kind: 'continuous',
  state: (runtime) => runtime.profession.core.adrenaline,
  maximum: (runtime) => balanceNumberFromContext(runtime, PROFILE.resources, 'maximumStacks'),
  initial: (runtime, maximum) => boundedNumber(runtime.config.initialResource ?? 0, 0, 0, maximum),
  recovery: () => 0,
  nextChange(runtime, cost) {
    const state = runtime.profession.core;
    return cost <= state.adrenaline.maximum &&
      state.nextSignetPulseAt > runtime.time &&
      Number.isFinite(state.nextSignetPulseAt)
      ? state.nextSignetPulseAt
      : Infinity;
  }
};

/** Skill variants read the accepted spend without mutating the reservation owned by the burst lifecycle. */
export function warriorBurstSpend(cast: RuntimeCast<WarriorSkill>): number | undefined {
  return warriorBurstSpends.get(cast);
}

/** Readiness and spending use the same family rules and fractional resource tolerance. */
export function warriorAdrenalineAvailability(
  runtime: MechanicQueriesOf<WarriorRuntime>,
  skill: WarriorSkill
): AvailabilityResult {
  const rules = warriorBurstRules(runtime);
  const cost = rules.required(runtime, skill);

  // Readiness and strict spending share the same tolerance for fractional trait rewards.
  if (!rules.bypass(runtime, skill) && !resourceAtLeast(runtime.resourceController.value('adrenaline'), cost))
    return {
      ready: false,
      retryAt: runtime.resourceController.readyAt('adrenaline', cost),
      code: 'warrior.adrenaline',
      reason: `${skill.name} requires ${cost} adrenaline.`
    };

  return { ready: true };
}

/** Capture actual adrenaline spending at acceptance before packet variants inspect the burst tier. */
export function beginWarriorBurst(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  if (cast.skill.burst && !cast.skill.dragonSlash) {
    const spent = warriorBurstRules(runtime).spend(runtime, cast.skill);
    runtime.resourceController.spend('adrenaline', spent);
    warriorBurstSpends.set(cast, spent);
  }
}

/** Every burst packet retains the same accepted spend and tier even if the live pool changes. */
export function modifyWarriorBurstEffects(
  runtime: WarriorRuntime,
  cast: RuntimeCast<WarriorSkill>,
  effects: SkillEffect[]
): SkillEffect[] {
  if (!cast.skill.burst || cast.skill.dragonSlash) return effects;

  const spent = warriorBurstSpends.get(cast)!;
  const tier = warriorBurstTier(runtime, spent);

  return effects.map((effect) => ({
    ...effect,
    metadata: { ...effect.metadata, warriorAdrenalineSpent: spent, warriorBurstTier: tier }
  }));
}

/** Completion rewards observe the captured spend before weapon-swap rewards, including zero-spend non-bursts. */
export function completeWarriorBurst(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  // Successful bursts refund the captured spend at completion, independently of target acceptance.
  const spent = warriorBurstSpends.get(cast) ?? 0;
  runtime.fireTrigger(burstCompleted, { cast, spent });
}

/** Misses never enter this surviving-hit boundary; activation identity prevents later packets claiming again. */
export function firstBurstHit(runtime: WarriorRuntime, event: Gw2ResolverEvent): boolean {
  const skill = runtime.helpers.skillsById.get(event.skillId ?? '');

  if (!skill?.burst || event.activationId == null) return false;

  if (!claimActivation(runtime.profession.core.activationClaims, 'warrior.burst-hit', event.activationId)) return false;

  runtime.fireTrigger(burstFirstHit, { event, skill });
  return true;
}

/** Cooldown resets refill only families whose burst rules use the adrenaline pool. */
export function resetWarriorAdrenaline(runtime: WarriorRuntime): void {
  if (warriorBurstRules(runtime).resetEligible)
    runtime.resourceController.grant('adrenaline', runtime.profession.core.adrenaline.maximum);
}

import { buildResolverBuff, buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
/** Owns imperative Core Necromancer Spite trait behavior for ordered dispatcher calls. */
import {
  balanceProfileEffect,
  balanceProfileFromContext,
  balanceProfileEffectFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { remainingTargetHealthBelow } from '#gw2/platform/combat/state/target-health.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { queueTraitCoefficientDamage } from '#gw2/professions/necromancer/core/mechanics/trait-effects.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import {
  predictNecromancerLifeForceGain,
  type NecromancerSchedulerFeedback
} from '#gw2/professions/necromancer/core/mechanics/scheduler-feedback.js';
import { isSchedulerComboPrediction } from '#gw2/platform/combos/events.js';
import { isSchedulerSigilPrediction } from '#gw2/platform/equipment/sigils/proc-events.js';
import type {
  NecromancerCastContext,
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerSchedulerContext,
  NecromancerSimulationEvent,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

/** Reports whether the target is strictly below half health, using the shared threshold contract. */
function targetBelowHalfHealth(context: NecromancerResolverContext): boolean {
  return remainingTargetHealthBelow(context.config, context, 0.5);
}

export function applyReapersMight(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  firstHit: boolean,
  shroudSkillOne: boolean
): void {
  if (!hasTrait(context, TRAIT.REAPERS_MIGHT) || !firstHit || !shroudSkillOne) return;
  const effect = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.reapersMight), 'boon');
  queueResolverBoon(
    context,
    event,
    buildResolverBuff({
      at: event.at,

      skillName: "Reaper's Might",
      kind: String(effect?.boon || 'might'),
      stacks: Number(effect?.stacks ?? 1),
      duration: Number(effect?.duration ?? 15),
      source: 'Trait',
      sourceId: TRAIT.REAPERS_MIGHT,
      actorType: 'effect',
      triggeredBy: event.skillName
    })
  );
  context.recordProc?.('trait', "Reaper's Might", event.at, event.skillName);
}

export function applySiphonedPower(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.SIPHONED_POWER) || !targetBelowHalfHealth(context)) return;
  const profile = balanceProfileFromContext(context, PROFILE.siphonedPower);
  const effect = balanceProfileEffect(profile, 'boon');
  // Claim only after local eligibility, before conditions, resources or queued strikes.
  if (
    !tryConsumeProcCooldown(
      professionCoreState(context).traitProcReadyAt,
      'siphonedPower',
      event.at,
      Number(profile?.cooldown ?? 1)
    )
  )
    return;
  queueResolverBoon(
    context,
    event,
    buildResolverBuff({
      at: event.at,

      skillName: 'Siphoned Power',
      kind: String(effect?.boon || 'might'),
      stacks: Number(effect?.stacks ?? 3),
      duration: Number(effect?.duration ?? 8),
      source: 'Trait',
      sourceId: TRAIT.SIPHONED_POWER,
      actorType: 'effect',
      triggeredBy: event.skillName
    })
  );
  context.recordProc?.('trait', 'Siphoned Power', event.at, event.skillName);
}

// Scheduler predictions and resolver observations must agree on the raw percentage each strike grants.
function spitefulFortitudeLifeForceGain(context: NecromancerSchedulerContext | NecromancerResolverContext): number {
  return Number(balanceProfileFromContext(context, PROFILE.spitefulFortitude)?.lifeForceGain ?? 1);
}

export function applySpitefulFortitude(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.SPITEFUL_FORTITUDE) || event.actorType !== 'player' || !targetBelowHalfHealth(context)) {
    return;
  }

  // Record raw percentage gains at the strike timestamp so refinement can verify the scheduler's prediction.
  context.resolved.push({
    type: 'necromancer.life-force-gain',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.SPITEFUL_FORTITUDE,
    actorType: 'effect',
    amount: spitefulFortitudeLifeForceGain(context)
  });
}

// Spiteful Fortitude grants this scheduler pass has already made at the half-health crossing timestamp.
const boundaryGrantCounts = new WeakMap<object, number>();

/**
 * Predicts Spiteful Fortitude from scheduled strikes once feedback knows when the target falls below half health.
 * Granting in the same pass removes a whole refinement pass that would only replay the previous pass's gains.
 */
export function predictSpitefulFortitude(
  context: NecromancerSchedulerContext,
  event: NecromancerSimulationEvent
): void {
  // Mirror the resolver: only positive-coefficient player strikes that reach the target can qualify.
  if (
    event.type !== 'damage' ||
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    event.offTarget === true ||
    isSchedulerComboPrediction(event) ||
    isSchedulerSigilPrediction(event) ||
    !hasTrait(context, TRAIT.SPITEFUL_FORTITUDE)
  )
    return;
  const feedback = context.config._schedulerFeedback as NecromancerSchedulerFeedback | undefined;
  const boundary = feedback?.targetBelowHalfAt;
  if (boundary == null || event.at < boundary) return;
  if (event.at === boundary) {
    // Same-time strikes resolved before the crossing strike were still above half, so grant only the resolver's count.
    const claimed = boundaryGrantCounts.get(context.state) || 0;
    if (claimed >= Number(feedback?.boundaryLifeForceGains || 0)) return;
    boundaryGrantCounts.set(context.state, claimed + 1);
  }

  predictNecromancerLifeForceGain(context, event.at, spitefulFortitudeLifeForceGain(context));
}

export function applyChillOfDeath(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.CHILL_OF_DEATH) || !targetBelowHalfHealth(context)) return;
  const profile = balanceProfileFromContext(context, PROFILE.chillOfDeath);
  // Claim only after local eligibility, before conditions, resources or queued strikes.
  if (
    !tryConsumeProcCooldown(
      professionCoreState(context).traitProcReadyAt,
      'chillOfDeath',
      event.at,
      Number(profile?.cooldown ?? 16)
    )
  )
    return;
  // No target boons can be removed, so use only the zero-boon strike profile.
  const coefficient = Number(balanceProfileEffect(profile, 'strike')?.coefficient ?? 0.6);
  queueTraitCoefficientDamage(context, event, {
    name: 'Lesser Spinal Shivers',
    traitId: TRAIT.CHILL_OF_DEATH,
    coefficient,
    noCrit: true
  });
}

/** Queue Chill from the resolved trait strike so sibling strikes keep their pre-Chill state. */
export function applyChillOfDeathCondition(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.actorType !== 'effect' || event.sourceId !== TRAIT.CHILL_OF_DEATH) return;
  const profile = balanceProfileFromContext(context, PROFILE.chillOfDeath);
  context.queue.enqueue(
    buildResolverCondition({
      condition: 'Chilled',
      stacks: 1,
      name: 'Lesser Spinal Shivers — Chilled',
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.CHILL_OF_DEATH,
      actorType: 'effect',
      skillName: 'Lesser Spinal Shivers',
      duration: Number(balanceProfileEffect(profile, 'condition')?.duration ?? 5)
    })
  );
}

export function applySignetsOfSuffering(context: NecromancerCastContext, skill: NecromancerSkill): void {
  if (!skill.categories?.includes('Signet') || !hasTrait(context, TRAIT.SIGNETS_OF_SUFFERING)) return;
  emitSkillDamage(context, skill, {
    at: context.effectiveEnd,
    name: 'Signets of Suffering',
    source: 'Trait',
    sourceId: TRAIT.SIGNETS_OF_SUFFERING,
    actorType: 'effect',
    coefficient: 0,
    skillWeapon: 'Unequipped',
    flatStrikeBase: Number(
      balanceProfileEffectFromContext(context, TRAIT.SIGNETS_OF_SUFFERING, 'strike', 0)!.flatStrikeBase
    ),
    noCrit: true,
    damageKind: 'life-steal'
  });
}

export function applyMaliciousSwarm(context: NecromancerCastContext, skill: NecromancerSkill): void {
  const state = professionCoreState(context);
  if (skill.type !== 'Heal' || !hasTrait(context, TRAIT.MALICIOUS_SWARM)) return;
  // Claim only after local eligibility, before conditions, resources or queued strikes.
  if (
    !tryConsumeProcCooldown(
      state.traitProcReadyAt,
      'maliciousSwarm',
      context.effectiveEnd,
      Number(balanceProfileFromContext(context, TRAIT.MALICIOUS_SWARM)?.internalCooldown)
    )
  )
    return;
  emitSkillDamage(context, skill, {
    at: context.effectiveEnd,
    name: 'Lesser Signet of the Locust',
    source: 'Trait',
    sourceId: TRAIT.MALICIOUS_SWARM,
    actorType: 'effect',
    coefficient: Number(balanceProfileEffectFromContext(context, TRAIT.MALICIOUS_SWARM, 'strike', 0)!.coefficient),
    skillWeapon: 'Unequipped'
  });
}

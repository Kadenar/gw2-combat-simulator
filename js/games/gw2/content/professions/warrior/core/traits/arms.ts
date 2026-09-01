/** Owns imperative Arms trait effects while the public dispatcher preserves base-effect ordering. */
import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { hasSelectedSkill, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { combinedTargetDamage } from '#gw2/platform/combat/state/target-health.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boon-duration.js';
import { advanceScheduledCriticalProc } from '#gw2/platform/scheduler/critical-facts.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/content/professions/warrior/data/ids.js';
import { gainWarriorAdrenaline } from '#gw2/content/professions/warrior/resources.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/warrior/core/profiles.js';
import {
  warriorActiveBuffStacks,
  warriorBoonActive,
  warriorEventSkill,
  warriorTargetControlled,
  warriorWieldingWeapon,
  type WarriorModifierAttributes
} from '#gw2/content/professions/warrior/core/traits/modifier-queries.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type {
  WarriorCastContext,
  WarriorResolverContext,
  WarriorResolverEvent,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill
} from '#gw2/content/professions/warrior/types.js';

// Trigger Lesser Signet of Might on the first eligible post-half-health strike, reserving its ICD first.
export function reactToWarriorDamage(context: WarriorResolverContext, event: WarriorResolverEvent): void {
  const targetHealth = Number(context.config.target?.health || 0);
  const damageDone = combinedTargetDamage(context);
  const state = professionCoreState(context);
  if (
    event.actorType !== 'player' ||
    !(Number(event.coefficient || 0) > 0) ||
    !(targetHealth > 0) ||
    damageDone < targetHealth * 0.5 ||
    !hasTrait(context, TRAIT.SIGNET_MASTERY) ||
    !isInternalCooldownReady(event.at, Number(state.traitProcReadyAt.lesserSignetMight || 0))
  ) {
    return;
  }

  const signetMastery = balanceProfileFromContext(context, PROFILE.signetMastery);
  state.traitProcReadyAt.lesserSignetMight = event.at + Number(signetMastery?.internalCooldown || 20);
  for (const effect of signetMastery?.effects || []) {
    const kind = String(effect.boon || effect.kind || '');
    enqueueOrdered(context.queue, {
      type: 'buff',
      at: event.at + EPSILON,
      priority: -5,
      source: 'Trait',
      sourceId: TRAIT.SIGNET_MASTERY,
      actorType: 'effect',
      skillId: TRAIT.SIGNET_MASTERY,
      skillName: 'Lesser Signet of Might',
      name: 'Lesser Signet of Might',
      kind,
      stacks: Number(effect.stacks || 1),
      duration: gw2ResolverBoonDuration(context, event, kind, Number(effect.duration || 0))
    });
  }

  context.recordProc(
    'trait',
    'Lesser Signet of Might',
    event.at,
    event.skillName,
    '10 might; Signet Mastery stack',
    String(context.helpers.skillsById?.get(ID.SIGNET_OF_MIGHT)?.icon || '')
  );
}

// Snapshot Burst Precision's duration by activation so the first delayed hit consumes the correct tier.
export function armBurstPrecision(context: WarriorCastContext, skill: WarriorSkill, spent: number): void {
  if (!skill.burst || spent <= 0 || !hasTrait(context, TRAIT.BURST_PRECISION)) return;
  const profile = balanceProfileFromContext(context, PROFILE.burstPrecision);
  professionCoreState(context).burstPrecisionDurations[context.reservationId] =
    spent >= 30 ? Number(profile?.maximumStacks || 4) : Number(profile?.minimumStacks || 2);
}

// Materialize Signet Mastery before relic and Strength cast-completion effects.
export function applySignetMasteryCastComplete(context: WarriorCastContext, skill: WarriorSkill): void {
  if (!skill.categories?.includes('Signet') || !hasTrait(context, TRAIT.SIGNET_MASTERY)) return;
  const effect = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.signetMastery), 'buff');
  emitSkillBuff(context, {
    at: context.effectiveEnd + context.epsilon,
    source: 'Trait',
    sourceId: TRAIT.SIGNET_MASTERY,
    actorType: 'effect',
    skillId: skill.id,
    skillName: skill.name,
    name: 'Signet Mastery',
    kind: 'signet-mastery',
    stacks: Number(effect?.stacks || 1),
    duration: Number(effect?.duration || 60)
  });
}

// Grant Opportunist before target-control bookkeeping and later control traits.
export function applyOpportunist(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  const trigger =
    (event.type === 'control' && event.actorType === 'player') ||
    (event.type === 'condition' && event.actorType === 'player' && event.condition === 'Immobilized');
  if (!trigger || !hasTrait(context, TRAIT.OPPORTUNIST)) return;
  const state = professionCoreState(context);
  if (!isInternalCooldownReady(event.at, Number(state.traitProcReadyAt.opportunist || 0))) return;
  const profile = balanceProfileFromContext(context, PROFILE.opportunist);
  const fury = balanceProfileEffect(profile, 'boon');
  state.traitProcReadyAt.opportunist = event.at + Number(profile?.internalCooldown || 1);
  gainWarriorAdrenaline(context, Number(profile?.resourceGain || 5));
  emitSkillBuff(context, {
    skill:
      context.catalog.skillsById.get(event.skillId ?? '') ||
      ({ id: TRAIT.OPPORTUNIST, name: 'Opportunist' } as WarriorSkill),
    cause: event,
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.OPPORTUNIST,
    actorType: 'effect',
    skillId: event.skillId,
    skillName: event.skillName,
    name: 'Opportunist',
    kind: 'fury',
    boon: 'fury',
    duration: Number(fury?.duration || 3),
    stacks: Number(fury?.stacks || 1),
    recipients: 'self'
  });
}

// Consume Burst Precision's activation snapshot at the first qualifying burst hit.
export function applyBurstPrecision(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
  skill: WarriorSkill,
  activationKey: string
): void {
  if (!hasTrait(context, TRAIT.BURST_PRECISION)) return;
  const state = professionCoreState(context);
  const duration = Number(state.burstPrecisionDurations[activationKey] || (Number(skill.burstTier || 1) >= 3 ? 4 : 2));
  delete state.burstPrecisionDurations[activationKey];
  emitSkillBuff(context, {
    cause: event,
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.BURST_PRECISION,
    actorType: 'effect',
    skillId: event.skillId,
    skillName: event.skillName,
    name: 'Burst Precision',
    kind: 'burst-precision',
    stacks: 1,
    duration
  });
}

// Return sampled critical hits or materialize deterministic critical probability as an integer count.
export function warriorArmsCriticalCount(context: WarriorSchedulerContext, event: WarriorSimulationEvent): number {
  const hits = Math.max(1, Number(event.hits || 1));
  const state = professionCoreState(context);
  const tracker = { progress: state.armsCriticalProgress, readyAt: 0 };
  const application = advanceScheduledCriticalProc(context, event, { id: 'warrior.core.arms-critical' }, tracker, hits);
  state.armsCriticalProgress = tracker.progress;
  return application?.quantity || 0;
}

// Apply Bloodlust's own per-critical proc chance without sharing Furious progress.
export function applyBloodlust(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  if (!hasTrait(context, TRAIT.BLOODLUST)) return;
  const profile = balanceProfileFromContext(context, PROFILE.bloodlust);
  const state = professionCoreState(context);
  const hits = Math.max(1, Number(event.hits || 1));
  const tracker = { progress: state.bloodlustProgress, readyAt: 0 };
  const application = advanceScheduledCriticalProc(
    context,
    event,
    {
      id: 'warrior.core.bloodlust',
      chanceOnCriticalHit: Number(profile?.procChance || 0.33),
      randomStream: 'warrior.bloodlust'
    },
    tracker,
    hits
  );
  state.bloodlustProgress = tracker.progress;
  const bleeding = application?.quantity || 0;
  if (bleeding <= 0) return;
  const effect = balanceProfileEffect(profile, 'condition');
  emitSkillCondition(context, {
    cause: event,
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.BLOODLUST,
    actorType: 'effect',
    skillId: event.skillId,
    skillName: event.skillName,
    name: 'Bloodlust — Bleeding',
    condition: 'Bleeding',
    stacks: bleeding * Number(effect?.stacks || 1),
    duration: Number(effect?.duration || 3)
  });
}

// Turn each materialized critical into adrenaline and Furious Surge stacks.
export function applyFurious(context: WarriorSchedulerContext, event: WarriorSimulationEvent, criticals: number): void {
  if (!hasTrait(context, TRAIT.FURIOUS) || criticals <= 0) return;
  const profile = balanceProfileFromContext(context, PROFILE.furious);
  const effect = balanceProfileEffect(profile, 'buff');
  gainWarriorAdrenaline(context, criticals * Number(profile?.resourceGain || 1));
  emitSkillBuff(context, {
    cause: event,
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.FURIOUS,
    actorType: 'effect',
    skillId: event.skillId,
    skillName: event.skillName,
    name: 'Furious Surge',
    kind: 'furious-surge',
    stacks: criticals * Number(effect?.stacks || 1),
    duration: Number(effect?.duration || 10)
  });
}

// Apply Sundering Burst last in the Arms critical materialization sequence.
export function applySunderingBurst(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
  firstBurstHit: boolean,
  criticals: number
): void {
  const state = professionCoreState(context);
  if (
    !firstBurstHit ||
    !hasTrait(context, TRAIT.SUNDERING_BURST) ||
    !isInternalCooldownReady(event.at, Number(state.traitProcReadyAt.sunderingBurst || 0))
  ) {
    return;
  }

  const profile = balanceProfileFromContext(context, PROFILE.sunderingBurst);
  const effect = balanceProfileEffect(profile, 'condition', criticals > 0 ? 1 : 0);
  state.traitProcReadyAt.sunderingBurst = event.at + Number(profile?.internalCooldown || 5);
  emitSkillCondition(context, {
    cause: event,
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.SUNDERING_BURST,
    actorType: 'effect',
    skillId: event.skillId,
    skillName: event.skillName,
    name: 'Sundering Burst — Vulnerability',
    condition: 'Vulnerability',
    stacks: Number(effect?.stacks || (criticals > 0 ? 10 : 5)),
    duration: Number(effect?.duration || 8)
  });
}

// Grant Furious Burst after Martial Cadence and Versatile Rage weapon-swap effects.
export function applyFuriousBurst(context: WarriorCastContext, skill: WarriorSkill): void {
  const state = professionCoreState(context);
  if (
    !hasTrait(context, TRAIT.FURIOUS_BURST) ||
    !isInternalCooldownReady(context.effectiveEnd, Number(state.traitProcReadyAt.furiousBurst || 0))
  ) {
    return;
  }

  const profile = balanceProfileFromContext(context, PROFILE.furiousBurst);
  const fury = balanceProfileEffect(profile, 'boon');
  state.traitProcReadyAt.furiousBurst = context.effectiveEnd + Number(profile?.internalCooldown || 4);
  emitSkillBuff(context, {
    at: context.effectiveEnd,
    source: 'Trait',
    sourceId: TRAIT.FURIOUS_BURST,
    actorType: 'effect',
    skillId: skill.id,
    skillName: skill.name,
    name: 'Furious Burst',
    kind: 'fury',
    boon: 'fury',
    stacks: Number(fury?.stacks || 1),
    duration: gw2SchedulerBoonDuration(context, skill, 'fury', Number(fury?.duration || 2.5))
  });
}

// Resolve Arms-owned attributes, including live signet state and critical-proc stacks.
export function modifyWarriorArmsAttributes(
  context: Gw2ModifierContext,
  result: WarriorModifierAttributes,
  staticRulesApplied: boolean
): void {
  const signetMastery = balanceProfileFromContext(context, PROFILE.signetMastery);
  const furious = balanceProfileFromContext(context, PROFILE.furious);
  const signetStacks = warriorActiveBuffStacks(context, 'signet-mastery', Number(signetMastery?.maximumStacks ?? 5));
  if (hasTrait(context, TRAIT.SIGNET_MASTERY)) {
    result.ferocity += signetStacks * Number(signetMastery?.attributeBonus ?? 100);
  }

  if (
    hasTrait(context, TRAIT.DEEP_STRIKES) &&
    warriorBoonActive(context, 'fury') &&
    !(staticRulesApplied && Boolean(context.config?.boons?.fury))
  ) {
    result.conditionDamage += Number(balanceProfileFromContext(context, PROFILE.deepStrikes)?.attributeBonus ?? 180);
  }

  if (hasTrait(context, TRAIT.BLADEMASTER) && warriorWieldingWeapon(context, 'Sword')) {
    result.conditionDamage += Number(balanceProfileFromContext(context, PROFILE.blademaster)?.attributeBonus ?? 120);
  }

  result.conditionDamage +=
    warriorActiveBuffStacks(context, 'furious-surge', Number(furious?.maximumStacks ?? 25)) *
    Number(furious?.attributeBonus ?? 15);
  if (hasTrait(context, TRAIT.BURST_PRECISION) && warriorActiveBuffStacks(context, 'burst-precision', 1) > 0) {
    result.ferocity += Number(balanceProfileFromContext(context, PROFILE.burstPrecision)?.attributeBonus ?? 250);
  }

  if (warriorActiveBuffStacks(context, 'signet-of-fury-active', 1) > 0) {
    const bonus = Number(balanceProfileFromContext(context, PROFILE.signetOfFuryActive)?.attributeBonus ?? 360);
    result.precision += bonus;
    result.ferocity += bonus;
  }

  for (const [name, id, attribute] of [
    ['Signet of Might', ID.SIGNET_OF_MIGHT, 'power'],
    ['Signet of Fury', ID.SIGNET_OF_FURY, 'precision']
  ] as const) {
    if (!hasSelectedSkill(context, name)) continue;
    const onCooldown = Boolean(context.timeline?.skillOnCooldownAt(id, context.time));
    if (staticRulesApplied ? onCooldown : !onCooldown) {
      const passiveBonus = Number(balanceProfileFromContext(context, PROFILE.signetPassives)?.attributeBonus ?? 180);
      result[attribute] += (staticRulesApplied ? -1 : 1) * passiveBonus;
    }
  }
}

export const warriorArmsModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'warrior.furious-burst-fury-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.05,
    when: (context) => hasTrait(context, TRAIT.FURIOUS_BURST) && warriorBoonActive(context, 'fury')
  },
  {
    id: 'warrior.deep-strikes',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.05,
    when: (context) => hasTrait(context, TRAIT.DEEP_STRIKES) && targetConditionActive(context, 'Bleeding')
  },
  {
    id: 'warrior.unsuspecting-foe',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.25,
    when: (context) => hasTrait(context, TRAIT.UNSUSPECTING_FOE) && warriorTargetControlled(context)
  },
  {
    id: 'warrior.burst-precision',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 1,
    when: (context) =>
      hasTrait(context, TRAIT.BURST_PRECISION) &&
      (Boolean(warriorEventSkill(context)?.burst) || warriorActiveBuffStacks(context, 'burst-precision', 1) > 0)
  }
]);

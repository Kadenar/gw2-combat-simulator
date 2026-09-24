import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber,
  procChanceFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';

import { buildResolverBuff } from '#gw2/platform/resolver/packets.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
/** Owns imperative Arms trait effects while the public dispatcher preserves base-effect ordering. */

import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasSelectedSkill, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { remainingTargetHealthBelow } from '#gw2/platform/combat/state/target-health.js';
import { advanceScheduledCriticalProc } from '#gw2/platform/execution/gw2-policy/critical-facts.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { gainWarriorAdrenaline } from '#gw2/professions/warrior/family-state.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import {
  warriorActiveBuffStacks,
  warriorBoonActive,
  warriorEventSkill,
  warriorTargetControlled,
  warriorWieldingWeapon,
  type WarriorModifierAttributes
} from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type {
  WarriorCastContext,
  WarriorResolverContext,
  WarriorResolverEvent,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill
} from '#gw2/professions/warrior/types.js';

// Trigger Lesser Signet of Might after the first eligible below-half-health strike at that strike's exact timestamp.
export function reactToWarriorDamage(context: WarriorResolverContext, event: WarriorResolverEvent): void {
  const state = professionCoreState(context);
  if (
    event.actorType !== 'player' ||
    !(Number(event.coefficient || 0) > 0) ||
    !remainingTargetHealthBelow(context.config, context, 0.5) ||
    !hasTrait(context, TRAIT.SIGNET_MASTERY)
  ) {
    return;
  }

  const signetMastery = requireBalanceProfileFromContext(context, PROFILE.signetMastery);
  // Reserve this trait's own deadline before emitting its effects.
  if (
    !tryConsumeProcCooldown(
      state.traitProcReadyAt,
      'lesserSignetMight',
      event.at,
      balanceProfileNumber(signetMastery, 'internalCooldown')
    )
  )
    return;
  for (const effect of signetMastery.effects || []) {
    const kind = String(effect.boon || effect.kind || '');
    queueResolverBoon(
      context,
      event,
      buildResolverBuff({
        at: event.at,
        priority: 5,
        source: 'Trait',
        sourceId: TRAIT.SIGNET_MASTERY,
        actorType: 'effect',
        skillId: TRAIT.SIGNET_MASTERY,
        skillName: 'Lesser Signet of Might',

        kind,
        stacks: effectNumber(signetMastery, effect, 'stacks'),
        duration: effectNumber(signetMastery, effect, 'duration')
      })
    );
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

  const burstPrecisionProfile = requireBalanceProfileFromContext(context, PROFILE.burstPrecision);
  professionCoreState(context).burstPrecisionDurations[context.reservationId] =
    spent >= 30
      ? balanceProfileNumber(burstPrecisionProfile, 'maximumStacks')
      : balanceProfileNumber(burstPrecisionProfile, 'minimumStacks');
}

// Materialize Signet Mastery at cast completion before relic and Strength completion effects.
export function applySignetMasteryCastComplete(context: WarriorCastContext, skill: WarriorSkill): void {
  if (!skill.categories?.includes('Signet') || !hasTrait(context, TRAIT.SIGNET_MASTERY)) return;
  const signetMasteryProfile = requireBalanceProfileFromContext(context, PROFILE.signetMastery);
  const effect = requireEffect(signetMasteryProfile, 'buff', 'signet-mastery');
  if (effect)
    emitSkillBuff(context, {
      at: context.effectiveEnd,
      source: 'Trait',
      sourceId: TRAIT.SIGNET_MASTERY,
      actorType: 'effect',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Signet Mastery',
      kind: 'signet-mastery',
      stacks: effectNumber(signetMasteryProfile, effect, 'stacks'),
      duration: effectNumber(signetMasteryProfile, effect, 'duration')
    });
}

// Grant Opportunist before target-control bookkeeping and later control traits.
export function applyOpportunist(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  const trigger =
    (event.type === 'control' && event.actorType === 'player') ||
    (event.type === 'condition' && event.actorType === 'player' && event.condition === 'Immobilized');
  if (!trigger || !hasTrait(context, TRAIT.OPPORTUNIST)) return;
  const state = professionCoreState(context);

  const opportunistProfile = requireBalanceProfileFromContext(context, PROFILE.opportunist);
  if (
    !tryConsumeProcCooldown(
      state.traitProcReadyAt,
      'opportunist',
      event.at,
      balanceProfileNumber(opportunistProfile, 'internalCooldown')
    )
  )
    return;
  const fury = requireEffect(opportunistProfile, 'boon', 'fury');
  gainWarriorAdrenaline(context, balanceProfileNumber(opportunistProfile, 'resourceGain'));
  if (fury)
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
      duration: effectNumber(opportunistProfile, fury, 'duration'),
      stacks: effectNumber(opportunistProfile, fury, 'stacks'),
      audience: { recipients: 'self' as const }
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
  const duration =
    state.burstPrecisionDurations[activationKey] ??
    balanceProfileNumber(
      requireBalanceProfileFromContext(context, PROFILE.burstPrecision),
      Number(skill.burstTier ?? 1) >= 3 ? 'maximumStacks' : 'minimumStacks'
    );
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

// Count the canonical seeded critical outcomes for Arms trait reactions.
export function warriorArmsCriticalCount(context: WarriorSchedulerContext, event: WarriorSimulationEvent): number {
  const hits = Math.max(1, Number(event.hits || 1));
  const application = advanceScheduledCriticalProc(
    context,
    event,
    { id: 'warrior.core.arms-critical' },
    undefined,
    hits
  );
  return application?.quantity || 0;
}

// Bloodlust rolls its own chance after the shared critical outcome.
export function applyBloodlust(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  if (!hasTrait(context, TRAIT.BLOODLUST)) return;

  const hits = Math.max(1, Number(event.hits || 1));
  const application = advanceScheduledCriticalProc(
    context,
    event,
    {
      id: 'warrior.core.bloodlust',
      chanceOnCriticalHit: procChanceFromContext(context, PROFILE.bloodlust),
      randomStream: 'warrior.bloodlust'
    },
    undefined,
    hits
  );
  const bleeding = application?.quantity || 0;
  if (bleeding <= 0) return;
  const bloodlustProfile = requireBalanceProfileFromContext(context, PROFILE.bloodlust);
  const effect = requireEffect(bloodlustProfile, 'condition', 'Bleeding');
  if (effect)
    emitSkillCondition(context, {
      cause: event,
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.BLOODLUST,
      actorType: 'effect',
      skillId: event.skillId,
      // Give the proc its own analysis row while retaining the attack that triggered it.
      skillName: 'Bloodlust',
      triggeredBy: event.skillName,
      name: 'Bloodlust — Bleeding',
      metadata: { procCount: bleeding },
      condition: 'Bleeding',
      stacks: bleeding * effectNumber(bloodlustProfile, effect, 'stacks'),
      duration: effectNumber(bloodlustProfile, effect, 'duration')
    });
}

// Turn each materialized critical into adrenaline and Furious Surge stacks.
export function applyFurious(context: WarriorSchedulerContext, event: WarriorSimulationEvent, criticals: number): void {
  if (!hasTrait(context, TRAIT.FURIOUS) || criticals <= 0) return;

  const furiousProfile = requireBalanceProfileFromContext(context, PROFILE.furious);
  const effect = requireEffect(furiousProfile, 'buff', 'furious-surge');
  gainWarriorAdrenaline(context, criticals * balanceProfileNumber(furiousProfile, 'resourceGain'));
  if (effect)
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
      stacks: criticals * effectNumber(furiousProfile, effect, 'stacks'),
      duration: effectNumber(furiousProfile, effect, 'duration')
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
  if (!firstBurstHit || !hasTrait(context, TRAIT.SUNDERING_BURST)) {
    return;
  }

  const sunderingBurstProfile = requireBalanceProfileFromContext(context, PROFILE.sunderingBurst);
  const effect = requireEffect(sunderingBurstProfile, 'condition', criticals > 0 ? 'Critical burst' : 'Burst');
  // Reserve this trait's own deadline before emitting its effects.
  if (
    !tryConsumeProcCooldown(
      state.traitProcReadyAt,
      'sunderingBurst',
      event.at,
      balanceProfileNumber(sunderingBurstProfile, 'internalCooldown')
    )
  )
    return;
  if (effect)
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
      stacks: effectNumber(sunderingBurstProfile, effect, 'stacks'),
      duration: effectNumber(sunderingBurstProfile, effect, 'duration')
    });
}

// Grant Furious Burst after Martial Cadence and Versatile Rage weapon-swap effects.
export function applyFuriousBurst(context: WarriorCastContext, skill: WarriorSkill): void {
  const state = professionCoreState(context);
  if (!hasTrait(context, TRAIT.FURIOUS_BURST)) {
    return;
  }

  const furiousBurstProfile = requireBalanceProfileFromContext(context, PROFILE.furiousBurst);
  const fury = requireEffect(furiousBurstProfile, 'boon', 'fury');
  // Reserve this trait's own deadline before emitting its effects.
  if (
    !tryConsumeProcCooldown(
      state.traitProcReadyAt,
      'furiousBurst',
      context.effectiveEnd,
      balanceProfileNumber(furiousBurstProfile, 'internalCooldown')
    )
  )
    return;
  if (fury)
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
      stacks: effectNumber(furiousBurstProfile, fury, 'stacks'),
      duration: gw2SchedulerBoonDuration(context, skill, 'fury', effectNumber(furiousBurstProfile, fury, 'duration'))
    });
}

// Resolve Arms-owned attributes, including live signet state and critical-proc stacks.
export function modifyWarriorArmsAttributes(
  context: Gw2ModifierContext,
  result: WarriorModifierAttributes,
  staticRulesApplied: boolean
): void {
  const signetMasteryProfile = requireBalanceProfileFromContext(context, PROFILE.signetMastery);
  const signetStacks = warriorActiveBuffStacks(
    context,
    'signet-mastery',
    balanceProfileNumber(signetMasteryProfile, 'maximumStacks')
  );
  if (hasTrait(context, TRAIT.SIGNET_MASTERY)) {
    result.ferocity += signetStacks * balanceProfileNumber(signetMasteryProfile, 'attributeBonus');
  }

  if (
    hasTrait(context, TRAIT.DEEP_STRIKES) &&
    warriorBoonActive(context, 'fury') &&
    !(staticRulesApplied && Boolean(context.config?.boons?.fury))
  ) {
    const deepStrikesProfile = requireBalanceProfileFromContext(context, PROFILE.deepStrikes);
    result.conditionDamage += balanceProfileNumber(deepStrikesProfile, 'attributeBonus');
  }

  if (hasTrait(context, TRAIT.BLADEMASTER) && warriorWieldingWeapon(context, 'Sword')) {
    const blademasterProfile = requireBalanceProfileFromContext(context, PROFILE.blademaster);
    result.conditionDamage += balanceProfileNumber(blademasterProfile, 'attributeBonus');
  }

  const furiousProfile = requireBalanceProfileFromContext(context, PROFILE.furious);
  result.conditionDamage +=
    warriorActiveBuffStacks(context, 'furious-surge', balanceProfileNumber(furiousProfile, 'maximumStacks')) *
    balanceProfileNumber(furiousProfile, 'attributeBonus');
  if (hasTrait(context, TRAIT.BURST_PRECISION) && warriorActiveBuffStacks(context, 'burst-precision', 1) > 0) {
    const burstPrecisionProfile = requireBalanceProfileFromContext(context, PROFILE.burstPrecision);
    result.ferocity += balanceProfileNumber(burstPrecisionProfile, 'attributeBonus');
  }

  if (warriorActiveBuffStacks(context, 'signet-of-fury-active', 1) > 0) {
    const signetOfFuryActiveProfile = requireBalanceProfileFromContext(context, PROFILE.signetOfFuryActive);
    const bonus = balanceProfileNumber(signetOfFuryActiveProfile, 'attributeBonus');
    result.precision += bonus;
    result.ferocity += bonus;
  }

  const activeSignets = (
    [
      ['Signet of Might', ID.SIGNET_OF_MIGHT, 'power'],
      ['Signet of Fury', ID.SIGNET_OF_FURY, 'precision']
    ] as const
  ).filter(([name, id]) => {
    if (!hasSelectedSkill(context, name)) return false;
    const onCooldown = Boolean(context.timeline?.skillOnCooldownAt(id, context.time));
    return staticRulesApplied ? onCooldown : !onCooldown;
  });
  if (activeSignets.length > 0) {
    const signetPassivesProfile = requireBalanceProfileFromContext(context, PROFILE.signetPassives);
    // Both eligible signets use the same passive bonus, read once before applying it.
    const passiveBonus = balanceProfileNumber(signetPassivesProfile, 'attributeBonus');
    for (const [, , attribute] of activeSignets) {
      result[attribute] += (staticRulesApplied ? -1 : 1) * passiveBonus;
    }
  }
}

export const warriorArmsModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'warrior.furious-burst-fury-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FURIOUS_BURST), 'criticalChance'),
    when: (context) => hasTrait(context, TRAIT.FURIOUS_BURST) && warriorBoonActive(context, 'fury')
  },
  {
    id: 'warrior.deep-strikes',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DEEP_STRIKES), 'criticalChance'),
    when: (context) => hasTrait(context, TRAIT.DEEP_STRIKES) && targetConditionActive(context, 'Bleeding')
  },
  {
    id: 'warrior.unsuspecting-foe',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.UNSUSPECTING_FOE), 'criticalChance'),
    when: (context) => hasTrait(context, TRAIT.UNSUSPECTING_FOE) && warriorTargetControlled(context)
  },
  {
    id: 'warrior.burst-precision',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BURST_PRECISION), 'criticalChance'),
    when: (context) =>
      hasTrait(context, TRAIT.BURST_PRECISION) &&
      (Boolean(warriorEventSkill(context)?.burst) || warriorActiveBuffStacks(context, 'burst-precision', 1) > 0)
  }
]);

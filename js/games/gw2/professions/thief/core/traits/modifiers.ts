import { EPSILON } from '#kernel/core/clock.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { compileGw2ModifierRules, MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { readProfessionCoreState, readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  eventSkill,
  hasSelectedSkill,
  playerHealthFraction,
  targetConditionActive,
  targetConditionCount,
  targetHealthBelow,
  targetHealthFraction
} from '#gw2/platform/combat/query/runtime-query.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { thiefCoreCastAvailability } from '#gw2/professions/thief/core/mechanics/availability.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/combat-query.js';
import type { ThiefPrecastContext, ThiefResolverContext, ThiefResolverEvent } from '#gw2/professions/thief/types.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';

export function thiefRuntimeState(context: Gw2ModifierContext): Partial<ThiefCoreState> {
  return readProfessionCoreState<ThiefCoreState>(context.runtime?.profession);
}

/** Lead Attacks also boosts owned flat life steal, which bypasses ordinary strike modifiers. */
export function modifyThiefLifeSiphon(context: ThiefResolverContext, event: ThiefResolverEvent) {
  if (
    !event.lifeSiphon ||
    ![event.flatDamage, event.flatStrikeBase, event.flatStrikePowerCoeff].some(Number.isFinite) ||
    !isGw2PlayerModifierOwnedEvent(event) ||
    !hasTrait(context.config, TRAIT.LEAD_ATTACKS)
  )
    return;

  const state = readProfessionCoreState<ThiefCoreState>(context.profession);
  const leadAttacksProfile = requireBalanceProfileFromContext(context, PROFILE.leadAttacks);
  const stacks = Math.min(
    balanceProfileNumber(leadAttacksProfile, 'maximumStacks'),
    Number(state.leadAttacksStacks || 0)
  );
  return {
    flatStrikeMultiplier:
      Number(event.flatStrikeMultiplier ?? 1) *
      (1 + stacks * balanceProfileNumber(leadAttacksProfile, 'damageIncreasePerStack'))
  };
}

// Return specialization state only when its runtime kind matches, preventing
// modifier rules from interpreting another Thief module's state shape.
export function thiefRuntimeSpecializationState<TState extends object = object>(
  context: Gw2ModifierContext,
  expectedKind: string
): Partial<TState> {
  return readProfessionSpecializationState<TState>(context.runtime?.profession, expectedKind) || {};
}

export const thiefCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'thief.exposed-weakness',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: {
      damagePerCondition: 0.02
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => 1 + targetConditionCount(context) * parameters.damagePerCondition,
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.EXPOSED_WEAKNESS)
  },
  {
    id: 'thief.vampiric-slash-vulnerable',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.5,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      context.event?.metadata?.packetKind === 'thief.vampiric-slash-life-siphon' &&
      targetConditionActive(context, 'Vulnerability')
  },
  {
    id: 'thief.executioner',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.EXECUTIONER) &&
      targetHealthBelow(context, 0.5)
  },
  {
    id: 'thief.ferocious-strikes',
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'multiply',
    factor: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FEROCIOUS_STRIKES), 'criticalDamage'),
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.FEROCIOUS_STRIKES) &&
      targetHealthFraction(context) > 0.5
  },
  {
    id: 'thief.twin-fangs-critical-damage',
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'multiply',
    // Preserve low-health stat previews; simulation queries always return full player health.
    factor: (context) =>
      balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.TWIN_FANGS),
        playerHealthFraction(context) > 0.5 ? 'criticalDamage' : 'lowHealthCriticalDamage'
      ),
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.TWIN_FANGS)
  },
  {
    id: 'thief.twin-fangs-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.TWIN_FANGS), 'criticalChance'),
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.TWIN_FANGS) &&
      Boolean(context.config?.target?.defiant)
  },
  {
    id: 'thief.deadly-aim',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.DEADLY_AIM) &&
      eventSkill(context)?.weapon === 'Pistol'
  },
  {
    id: 'thief.larcenous-strike-boonless',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && eventSkill(context)?.id === ID.LARCENOUS_STRIKE
  },
  {
    id: 'thief.lead-attacks',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    parameters: {
      maximumStacks: 15,
      damagePerStack: 0.01
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      Math.min(parameters.maximumStacks, Number(thiefRuntimeState(context).leadAttacksStacks || 0)) *
      parameters.damagePerStack,
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.LEAD_ATTACKS)
  },
  {
    id: 'thief.fluid-strikes',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.FLUID_STRIKES) &&
      Number(thiefRuntimeState(context).fluidStrikesUntil || 0) > context.time
  },
  {
    id: 'thief.distracting-throw-finisher',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      Number(thiefRuntimeState(context).distractingThrowBuffUntil || 0) > context.time
  },
  {
    id: 'thief.backstab-position',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 2,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      eventSkill(context)?.id === ID.BACKSTAB &&
      Boolean(context.config?.target?.defiant)
  },
  {
    id: 'thief.potent-poison-damage',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.33,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      context.event?.condition === 'Poisoned' &&
      hasTrait(context, TRAIT.POTENT_POISON)
  },
  {
    id: 'thief.deadly-ambush-bleeding',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      context.event?.condition === 'Bleeding' &&
      hasTrait(context, TRAIT.DEADLY_AMBUSH)
  },
  {
    id: 'thief.potent-poison-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.POTENT_POISON), 'conditionDurationBonus'),
    // Specific condition-duration bonuses add to Expertise and are skipped when panel stats already include them.
    when: (context) =>
      context.event?.condition === 'Poisoned' &&
      hasTrait(context, TRAIT.POTENT_POISON) &&
      !professionStaticRulesApplied(context.config)
  },
  {
    id: 'thief.keen-observer',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    // Preserve low-health stat previews; simulation queries always return full player health.
    amount: (context) => {
      const keenObserverProfile = requireBalanceProfileFromContext(context, TRAIT.KEEN_OBSERVER);
      return playerHealthFraction(context) > 0.5
        ? balanceProfileNumber(keenObserverProfile, 'criticalChance')
        : balanceProfileNumber(keenObserverProfile, 'lowHealthCriticalChance');
    },
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.KEEN_OBSERVER)
  },
  {
    id: 'thief.hidden-killer',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.HIDDEN_KILLER), 'criticalChance'),
    when: (context) => {
      const state = thiefRuntimeState(context);
      return (
        isGw2PlayerModifierOwnedEvent(context.event) &&
        hasTrait(context, TRAIT.HIDDEN_KILLER) &&
        // The explicit expiry is armed by stealth, never by the initial Revealed sentinel.
        Number(state.stealthStartedAt || 0) <= context.time &&
        (Number(state.stealthUntil || 0) > context.time || Number(state.hiddenKillerUntil || 0) > context.time)
      );
    }
  }
]);

// Reconcile build-time Thief stats with live signet, Revealed, and Fury state so
// passive and temporary attribute bonuses are applied exactly once.
function modifyThiefCoreAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const result = { ...attributes };
  const state = thiefRuntimeState(context);
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  if (hasSelectedSkill(context, 'Signet of Agility')) {
    const signetOfAgilityProfile = requireBalanceProfileFromContext(context, PROFILE.signetOfAgility);
    // Reconcile panel precision with recharge so the passive disappears only while the signet is unavailable.
    const passiveBonus = balanceProfileNumber(signetOfAgilityProfile, 'attributeBonus');
    const passiveDisabled = context.timeline?.skillOnCooldownAt(ID.SIGNET_OF_AGILITY, context.time);
    if (staticRulesApplied && passiveDisabled) result.precision -= passiveBonus;
    if (!staticRulesApplied && !passiveDisabled) result.precision += passiveBonus;
  }

  if (hasSelectedSkill(context, "Assassin's Signet")) {
    const assassinsSignetProfile = requireBalanceProfileFromContext(context, PROFILE.assassinsSignet);
    const passive = balanceProfileNumber(assassinsSignetProfile, 'attributeBonus');
    const passiveDisabled = Number(state.assassinsSignetPassiveDisabledUntil || 0) > context.time;
    if (staticRulesApplied && passiveDisabled) result.power -= passive;
    if (!staticRulesApplied && !passiveDisabled) result.power += passive;
    if (Number(state.assassinsSignetActiveUntil || 0) > context.time) {
      result.power += balanceProfileNumber(assassinsSignetProfile, 'attributePerStack');
    }
  }

  if (hasTrait(context, TRAIT.REVEALED_TRAINING)) {
    if (!staticRulesApplied) {
      const revealedTrainingProfile = requireBalanceProfileFromContext(context, PROFILE.revealedTraining);
      result.power += balanceProfileNumber(revealedTrainingProfile, 'attributeBonus');
    }

    if (Number(state.revealedUntil || 0) > context.time && !eventSkill(context)?.stealthAttack) {
      const revealedTrainingProfile = requireBalanceProfileFromContext(context, PROFILE.revealedTraining);
      result.power += balanceProfileNumber(revealedTrainingProfile, 'attributePerStack');
    }
  }

  if (
    hasTrait(context, TRAIT.NO_QUARTER) &&
    context.query?.furyActiveAt(context.time, context.runtime, context.event) &&
    !(staticRulesApplied && Boolean((context.config?.boons as Record<string, unknown>)?.fury))
  ) {
    const noQuarterProfile = requireBalanceProfileFromContext(context, PROFILE.noQuarter);
    result.ferocity += balanceProfileNumber(noQuarterProfile, 'attributeBonus');
  }

  return result;
}

export const thiefCoreAttributeRules = Object.freeze({
  modifyAttributes: modifyThiefCoreAttributes,
  modifierRules: thiefCoreModifierRules,
  compileModifierRules: compileGw2ModifierRules
});

function modifyThiefCoreRechargeDuration(context: ThiefPrecastContext, duration: number): number {
  const skill = context.skill;
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  if (skill.usableWhileRecharging === true && readyAt > context.start + EPSILON) {
    return 0;
  }

  let result = duration;
  if (skill.stealTraitSkill) {
    const leadAttacks = hasTrait(context.config, TRAIT.LEAD_ATTACKS);
    const sleightOfHand = hasTrait(context.config, TRAIT.SLEIGHT_OF_HAND);
    const leadAttacksProfile = requireBalanceProfileFromContext(context, PROFILE.leadAttacks);
    const leadMultiplier = balanceProfileNumber(leadAttacksProfile, 'rechargeMultiplier');
    const sleightOfHandProfile = requireBalanceProfileFromContext(context, PROFILE.sleightOfHand);
    const sleightMultiplier = balanceProfileNumber(sleightOfHandProfile, 'rechargeMultiplier');
    if (skill.stealRechargeMode === 'additive') {
      // Skills can own an additive exception while the base traits remain shared.
      result *= 1 - Number(leadAttacks) * (1 - leadMultiplier) - Number(sleightOfHand) * (1 - sleightMultiplier);
    } else {
      if (leadAttacks) result *= leadMultiplier;
      if (sleightOfHand) result *= sleightMultiplier;
    }
  }

  return result;
}

export const thiefCoreCastRules = Object.freeze({
  availability: {
    id: 'thief.core-availability',
    order: 10,
    handler: thiefCoreCastAvailability
  },
  modifyRechargeDuration: modifyThiefCoreRechargeDuration
});

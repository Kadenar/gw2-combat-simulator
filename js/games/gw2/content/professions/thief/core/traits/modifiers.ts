import { createModifierHooks, MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { readProfessionCoreState, readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { isGw2PlayerModifierEligibleEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  eventSkill,
  hasSelectedSkill,
  targetConditionActive,
  targetConditionCount,
  targetHealthFraction
} from '#gw2/platform/combat/query/runtime-query.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/content/professions/thief/data/ids.js';
import { thiefCoreCastAvailability } from '#gw2/content/professions/thief/core/mechanics/availability.js';
import {
  advanceThiefCoreResources,
  completeThiefCoreResources,
  spendThiefCoreResources
} from '#gw2/content/professions/thief/core/mechanics/initiative-and-endurance.js';
import { snapshotThiefState } from '#gw2/content/professions/thief/core/state.js';
import { updateThiefTraitCastState } from '#gw2/content/professions/thief/core/traits/index.js';
import { updateThiefWeaponState } from '#gw2/content/professions/thief/core/mechanics/weapon-state.js';
import { thiefCoreTaskHandlers } from '#gw2/content/professions/thief/core/mechanics/task-handlers.js';
import { applyThiefWeaponSwapEffects } from '#gw2/content/professions/thief/core/skills/actions.js';
import type { SchedulerRecord, Skill } from '#gw2/platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierHooks, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/types.js';
import type {
  ThiefCoreState,
  ThiefPrecastContext,
  ThiefSchedulerContext
} from '#gw2/content/professions/thief/types.js';
import {
  thiefBalanceProfile,
  THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE
} from '#gw2/content/professions/thief/core/profiles.js';

export function thiefEventSkill(context: Gw2ModifierContext): Skill | undefined {
  return eventSkill(context);
}

export function thiefRuntimeState(context: Gw2ModifierContext): Partial<ThiefCoreState> {
  return readProfessionCoreState<ThiefCoreState>(context.runtime?.profession);
}

// Return specialization state only when its runtime kind matches, preventing
// modifier rules from interpreting another Thief module's state shape.
export function thiefRuntimeSpecializationState<TState extends object = SchedulerRecord>(
  context: Gw2ModifierContext,
  expectedKind: string
): Partial<TState> {
  return readProfessionSpecializationState<TState>(context.runtime?.profession, expectedKind) || {};
}

function targetBoonless(context: Gw2ModifierContext): boolean {
  return context.config?.target?.boonless !== false;
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
    when: (context) => isGw2PlayerModifierEligibleEvent(context.event) && hasTrait(context, TRAIT.EXPOSED_WEAKNESS)
  },
  {
    id: 'thief.vampiric-slash-vulnerable',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.5,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      context.event?.name === 'Vampiric Slash — Life Siphon' &&
      targetConditionActive(context, 'Vulnerability')
  },
  {
    id: 'thief.executioner',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, TRAIT.EXECUTIONER) &&
      targetHealthFraction(context) < 0.5
  },
  {
    id: 'thief.ferocious-strikes',
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, TRAIT.FEROCIOUS_STRIKES) &&
      targetHealthFraction(context) > 0.5
  },
  {
    id: 'thief.twin-fangs-critical-damage',
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'multiply',
    factor: 1.07,
    when: (context) => isGw2PlayerModifierEligibleEvent(context.event) && hasTrait(context, TRAIT.TWIN_FANGS)
  },
  {
    id: 'thief.twin-fangs-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.07,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, TRAIT.TWIN_FANGS) &&
      Boolean(context.config?.target?.defiant)
  },
  {
    id: 'thief.deadly-aim',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, TRAIT.DEADLY_AIM) &&
      thiefEventSkill(context)?.weapon === 'Pistol'
  },
  {
    id: 'thief.larcenous-strike-boonless',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      thiefEventSkill(context)?.name === 'Larcenous Strike' &&
      targetBoonless(context)
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
    when: (context) => isGw2PlayerModifierEligibleEvent(context.event) && hasTrait(context, TRAIT.LEAD_ATTACKS)
  },
  {
    id: 'thief.fluid-strikes',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, TRAIT.FLUID_STRIKES) &&
      Number(thiefRuntimeState(context).fluidStrikesUntil || 0) > context.time
  },
  {
    id: 'thief.distracting-throw-finisher',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      Number(thiefRuntimeState(context).distractingThrowBuffUntil || 0) > context.time
  },
  {
    id: 'thief.backstab-position',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 2,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      thiefEventSkill(context)?.id === ID.BACKSTAB &&
      Boolean(context.config?.target?.defiant)
  },
  {
    id: 'thief.potent-poison-damage',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.33,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      context.event?.condition === 'Poisoned' &&
      hasTrait(context, TRAIT.POTENT_POISON)
  },
  {
    id: 'thief.deadly-ambush-bleeding',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      context.event?.condition === 'Bleeding' &&
      hasTrait(context, TRAIT.DEADLY_AMBUSH)
  },
  {
    id: 'thief.potent-poison-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'add',
    amount: 0.33,
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
    amount: 0.15,
    when: (context) => isGw2PlayerModifierEligibleEvent(context.event) && hasTrait(context, TRAIT.KEEN_OBSERVER)
  },
  {
    id: 'thief.hidden-killer',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 1,
    when: (context) => {
      const state = thiefRuntimeState(context);
      return (
        isGw2PlayerModifierEligibleEvent(context.event) &&
        hasTrait(context, TRAIT.HIDDEN_KILLER) &&
        (Number(state.stealthUntil || 0) > context.time || Number(state.revealedUntil || 0) + 1 > context.time)
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
  if (hasSelectedSkill(context, "Assassin's Signet")) {
    const profile = thiefBalanceProfile(context, PROFILE.assassinsSignet);
    const passive = Number(profile?.attributeBonus || 180);
    const passiveDisabled = Number(state.assassinsSignetPassiveDisabledUntil || 0) > context.time;
    if (staticRulesApplied && passiveDisabled) result.power -= passive;
    if (!staticRulesApplied && !passiveDisabled) result.power += passive;
    if (Number(state.assassinsSignetActiveUntil || 0) > context.time) {
      result.power += Number(profile?.attributePerStack || 540);
    }
  }

  if (hasTrait(context, TRAIT.REVEALED_TRAINING)) {
    const profile = thiefBalanceProfile(context, PROFILE.revealedTraining);
    if (!staticRulesApplied) {
      result.power += Number(profile?.attributeBonus || 80);
    }

    if (Number(state.revealedUntil || 0) > context.time && !thiefEventSkill(context)?.stealthAttack) {
      result.power += Number(profile?.attributePerStack || 120);
    }
  }

  if (
    hasTrait(context, TRAIT.NO_QUARTER) &&
    context.query?.furyActiveAt(context.time, context.runtime, context.event) &&
    !(staticRulesApplied && Boolean((context.config?.boons as Record<string, unknown>)?.fury))
  ) {
    result.ferocity += Number(thiefBalanceProfile(context, PROFILE.noQuarter)?.attributeBonus || 250);
  }

  return result;
}

export function compileThiefModifierRules(rules: readonly Gw2ModifierRule[]): Gw2ModifierHooks {
  return createModifierHooks({ rules });
}

export const thiefCoreAttributeRules = Object.freeze({
  modifyAttributes: modifyThiefCoreAttributes,
  modifierRules: thiefCoreModifierRules,
  compileModifierRules: compileThiefModifierRules
});

function modifyThiefCoreRechargeDuration(context: ThiefPrecastContext, duration: number): number {
  const skill = context.skill;
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  if (skill.usableWhileRecharging === true && readyAt > context.start + Number(context.epsilon || 0.0001)) {
    return 0;
  }

  let result = duration;
  if (skill.stealTraitSkill) {
    const leadAttacks = hasTrait(context.config, TRAIT.LEAD_ATTACKS);
    const sleightOfHand = hasTrait(context.config, TRAIT.SLEIGHT_OF_HAND);
    const leadMultiplier = Number(thiefBalanceProfile(context, PROFILE.leadAttacks)?.rechargeMultiplier ?? 0.85);
    const sleightMultiplier = Number(thiefBalanceProfile(context, PROFILE.sleightOfHand)?.rechargeMultiplier ?? 0.8);
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

export const thiefCoreSchedulerHooks = Object.freeze({
  advance: advanceThiefCoreResources,
  onCastStart: spendThiefCoreResources,
  // Thief stance and trait effects run only after the shared swap is committed.
  onWeaponSwap: applyThiefWeaponSwapEffects,
  onCastComplete: {
    id: 'thief.core-resources',
    order: 10,
    handler: completeThiefCoreResources
  },
  afterCast: Object.freeze([
    {
      id: 'thief.weapon-state',
      order: 10,
      handler: updateThiefWeaponState
    },
    {
      id: 'thief.traits',
      order: 20,
      handler: updateThiefTraitCastState
    }
  ]),
  taskHandlers: thiefCoreTaskHandlers,
  snapshot: (context: ThiefSchedulerContext) => snapshotThiefState(context.state.profession)
});

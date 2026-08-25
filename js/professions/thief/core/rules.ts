import { createModifierHooks, MODIFIER_TARGET } from '../../../platform/gw2/combat/modifiers/rules.js';
import { professionStaticRulesApplied } from '../../../platform/gw2/builds/attribute-provenance.js';
import { hasTrait } from '../../../platform/gw2/combat/state/traits.js';
import {
  eventSkill,
  hasSelectedSkill,
  targetConditionCount,
  targetHealthFraction
} from '../../../platform/gw2/combat/query/runtime-query.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { thiefCoreCastAvailability } from './availability.js';
import { advanceThiefCoreResources, completeThiefCoreResources, spendThiefCoreResources } from './resources.js';
import { hasThiefTrait } from './state.js';
import { snapshotThiefState } from '../state.js';
import { updateThiefTraitCastState } from './traits.js';
import { updateThiefWeaponState } from './weapon-state.js';
import { thiefCoreTaskHandlers } from './tasks.js';
import { applyThiefWeaponSwapEffects } from './actions.js';
import type { SchedulerRecord, Skill } from '../../../platform/engine/types.js';
import type {
  Gw2ModifierContext,
  Gw2ModifierHooks,
  Gw2ModifierRule
} from '../../../platform/gw2/combat/modifiers/types.js';
import type { Gw2ResolvedStats } from '../../../platform/gw2/combat/query/types.js';
import type { ThiefCoreState, ThiefPrecastContext, ThiefQueryRuntime, ThiefSchedulerContext } from '../types.js';
import { thiefBalanceProfile, THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

export function thiefEventSkill(context: Gw2ModifierContext): Skill | undefined {
  return eventSkill(context);
}

export function thiefPlayerEvent(context: Gw2ModifierContext): boolean {
  return context.event?.actorType !== 'summon';
}

export function thiefRuntimeState(context: Gw2ModifierContext): Partial<ThiefCoreState> {
  const state = (context.runtime as ThiefQueryRuntime | undefined)?.profession;
  if (!state) return {};
  return 'core' in state && state.core ? state.core : (state as Partial<ThiefCoreState>);
}

export function thiefRuntimeSpecializationState<TState extends object = SchedulerRecord>(
  context: Gw2ModifierContext,
  expectedKind: string
): Partial<TState> {
  const state = (context.runtime as ThiefQueryRuntime | undefined)?.profession || {};
  if (
    'specialization' in state &&
    state.specialization &&
    typeof state.specialization === 'object' &&
    state.specialization.state
  ) {
    if (state.specialization.kind !== expectedKind) {
      throw new TypeError(`Expected active specialization ${expectedKind}, received ${state.specialization.kind}.`);
    }

    return state.specialization.state as unknown as Partial<TState>;
  }

  return state as Partial<TState>;
}

export function thiefTargetHealthFraction(context: Gw2ModifierContext): number {
  return targetHealthFraction(context);
}

export function thiefTargetHasCondition(context: Gw2ModifierContext, condition: string): boolean {
  return Boolean(context.query?.targetHasCondition(condition, context.time, context.runtime));
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
    when: (context) => thiefPlayerEvent(context) && hasTrait(context, TRAIT.EXPOSED_WEAKNESS)
  },
  {
    id: 'thief.vampiric-slash-vulnerable',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.5,
    when: (context) =>
      thiefPlayerEvent(context) &&
      context.event?.name === 'Vampiric Slash — Life Siphon' &&
      thiefTargetHasCondition(context, 'Vulnerability')
  },
  {
    id: 'thief.executioner',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) =>
      thiefPlayerEvent(context) && hasTrait(context, TRAIT.EXECUTIONER) && thiefTargetHealthFraction(context) < 0.5
  },
  {
    id: 'thief.ferocious-strikes',
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      thiefPlayerEvent(context) &&
      hasTrait(context, TRAIT.FEROCIOUS_STRIKES) &&
      thiefTargetHealthFraction(context) > 0.5
  },
  {
    id: 'thief.twin-fangs-critical-damage',
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'multiply',
    factor: 1.07,
    when: (context) => thiefPlayerEvent(context) && hasTrait(context, TRAIT.TWIN_FANGS)
  },
  {
    id: 'thief.twin-fangs-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.07,
    when: (context) =>
      thiefPlayerEvent(context) && hasTrait(context, TRAIT.TWIN_FANGS) && Boolean(context.config?.target?.defiant)
  },
  {
    id: 'thief.deadly-aim',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      thiefPlayerEvent(context) && hasTrait(context, TRAIT.DEADLY_AIM) && thiefEventSkill(context)?.weapon === 'Pistol'
  },
  {
    id: 'thief.larcenous-strike-boonless',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) =>
      thiefPlayerEvent(context) && thiefEventSkill(context)?.name === 'Larcenous Strike' && targetBoonless(context)
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
    when: (context) => thiefPlayerEvent(context) && hasTrait(context, TRAIT.LEAD_ATTACKS)
  },
  {
    id: 'thief.fluid-strikes',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      thiefPlayerEvent(context) &&
      hasTrait(context, TRAIT.FLUID_STRIKES) &&
      Number(thiefRuntimeState(context).fluidStrikesUntil || 0) > context.time
  },
  {
    id: 'thief.distracting-throw-finisher',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      thiefPlayerEvent(context) && Number(thiefRuntimeState(context).distractingThrowBuffUntil || 0) > context.time
  },
  {
    id: 'thief.backstab-position',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 2,
    when: (context) =>
      thiefPlayerEvent(context) &&
      thiefEventSkill(context)?.id === ID.BACKSTAB &&
      Boolean(context.config?.target?.defiant)
  },
  {
    id: 'thief.potent-poison-damage',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.33,
    when: (context) =>
      thiefPlayerEvent(context) && context.event?.condition === 'Poisoned' && hasTrait(context, TRAIT.POTENT_POISON)
  },
  {
    id: 'thief.deadly-ambush-bleeding',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    when: (context) =>
      thiefPlayerEvent(context) && context.event?.condition === 'Bleeding' && hasTrait(context, TRAIT.DEADLY_AMBUSH)
  },
  {
    id: 'thief.potent-poison-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'multiply',
    factor: 1.33,
    when: (context) => context.event?.condition === 'Poisoned' && hasTrait(context, TRAIT.POTENT_POISON)
  },
  {
    id: 'thief.keen-observer',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.15,
    when: (context) => thiefPlayerEvent(context) && hasTrait(context, TRAIT.KEEN_OBSERVER)
  },
  {
    id: 'thief.hidden-killer',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 1,
    when: (context) => {
      const state = thiefRuntimeState(context);
      return (
        thiefPlayerEvent(context) &&
        hasTrait(context, TRAIT.HIDDEN_KILLER) &&
        (Number(state.stealthUntil || 0) > context.time || Number(state.revealedUntil || 0) + 1 > context.time)
      );
    }
  }
]);

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
    const leadAttacks = hasThiefTrait(context.config, TRAIT.LEAD_ATTACKS);
    const sleightOfHand = hasThiefTrait(context.config, TRAIT.SLEIGHT_OF_HAND);
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

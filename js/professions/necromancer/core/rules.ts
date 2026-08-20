import { targetHasCondition as targetHasConfiguredCondition } from '../../../platform/gw2/target-state.js';
import { createModifierHooks, MODIFIER_TARGET } from '../../../platform/gw2/modifier-rules.js';
import { professionStaticRulesApplied } from '../../../platform/gw2/attribute-provenance.js';
import { hasTrait } from '../../../platform/gw2/trait-state.js';
import {
  eventSkill,
  hasSelectedSkill,
  targetConditionCount,
  targetHealthFraction
} from '../../../platform/gw2/runtime-query.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { necromancerCastRules, necromancerCoreSkillMechanicHandlers, necromancerSchedulerHooks } from './contract.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE, necromancerBalanceProfile } from './profiles.js';
import type { SchedulerRecord } from '../../../platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../platform/gw2/types.js';
import type {
  NecromancerCoreState,
  NecromancerQueryRuntime,
  NecromancerRechargeModifierContext,
  NecromancerRuntimeState,
  NecromancerSkill,
  NecromancerState
} from '../types.js';

function queryProfessionState(context: Gw2ModifierContext): Partial<NecromancerState> | NecromancerRuntimeState {
  return (context.runtime as NecromancerQueryRuntime | null | undefined)?.profession || {};
}

export function necromancerRuntimeCoreState(context: Gw2ModifierContext): Partial<NecromancerCoreState> {
  const state = queryProfessionState(context);
  const runtime = state as Partial<NecromancerRuntimeState>;
  return runtime.core && typeof runtime.core === 'object' ? runtime.core : (state as Partial<NecromancerCoreState>);
}

export function necromancerRuntimeSpecializationState(context: Gw2ModifierContext): Partial<NecromancerState> {
  const state = queryProfessionState(context);
  const runtime = state as Partial<NecromancerRuntimeState>;
  return runtime.specialization && typeof runtime.specialization === 'object' && runtime.specialization.state
    ? runtime.specialization.state
    : (state as Partial<NecromancerState>);
}

export function necromancerEventSkill(context: Gw2ModifierContext): NecromancerSkill | undefined {
  return eventSkill<NecromancerSkill>(context);
}

export function necromancerTargetHasCondition(context: Gw2ModifierContext, condition: string): boolean {
  if (context.query?.targetHasCondition) {
    return Boolean(context.query.targetHasCondition(condition, context.time, context.runtime));
  }

  return targetHasConfiguredCondition(context.config || {}, condition, context.time, context.runtime);
}

export function necromancerTargetConditionCount(context: Gw2ModifierContext): number {
  return targetConditionCount(context);
}

export function necromancerTargetHealthFraction(context: Gw2ModifierContext): number {
  return targetHealthFraction(context);
}

export function necromancerActiveShroud(context: Gw2ModifierContext): string {
  return String(necromancerRuntimeCoreState(context).activeShroud || '');
}

export function necromancerTargetChilled(context: Gw2ModifierContext): boolean {
  return (
    necromancerTargetHasCondition(context, 'Chilled') ||
    Number(necromancerRuntimeCoreState(context).targetChilledUntil || 0) > context.time
  );
}

export function necromancerTargetControlled(context: Gw2ModifierContext): boolean {
  return (
    Boolean(context.config?.target?.controlled) ||
    (context.config?.target?.defiant !== true &&
      Number(necromancerRuntimeCoreState(context).targetControlledUntil || 0) > context.time)
  );
}

export function cloneNecromancerAttributes(attributes: SchedulerRecord): SchedulerRecord & {
  power: number;
  precision: number;
  vitality: number;
  ferocity: number;
  conditionDamage: number;
  expertise: number;
  concentration: number;
} {
  return { ...attributes } as SchedulerRecord & {
    power: number;
    precision: number;
    vitality: number;
    ferocity: number;
    conditionDamage: number;
    expertise: number;
    concentration: number;
  };
}

export function necromancerCriticalExpectedFactor(context: Gw2ModifierContext, criticalHitFactor: number): number {
  if (!context.query || !context.event) return 1;
  const critical = context.query.critical(context.event, context.time, context.runtime);
  const normalExpected = 1 + critical.chance * (critical.damage - 1);
  const modifiedExpected = 1 - critical.chance + critical.chance * critical.damage * criticalHitFactor;
  return modifiedExpected / normalExpected;
}

function signetOfSpitePassiveActive(context: Gw2ModifierContext): boolean {
  return (
    hasSelectedSkill(context, 'Signet of Spite') &&
    !necromancerActiveShroud(context) &&
    !context.timeline?.skillOnCooldownAt(ID.SIGNET_OF_SPITE, context.time)
  );
}

export function modifyNecromancerCoreAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord
): SchedulerRecord {
  const result = cloneNecromancerAttributes(attributes);
  // Conversions read gear-only stats. config.stats excludes might
  // (baked into the seed's power/condition damage) and live trait bonuses
  // (accrued on `result`).
  const gearPower = Number(context.config?.stats?.power || 0);
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  if (hasSelectedSkill(context, 'Signet of Spite')) {
    const signetPower = Number(necromancerBalanceProfile(context, PROFILE.signetOfSpite)?.attributeBonus || 180);
    const passiveActive = context.actorType !== 'summon' && signetOfSpitePassiveActive(context);
    if (staticRulesApplied) {
      if (!passiveActive) result.power -= signetPower;
    } else if (passiveActive) {
      result.power += signetPower;
    }
  }

  const timedCarapace = (necromancerRuntimeCoreState(context).carapaceExpiries || []).filter(
    (expiresAt: number) => expiresAt > context.time
  ).length;
  const minionCarapace = hasTrait(context, TRAIT.FLESH_OF_THE_MASTER)
    ? Object.values(necromancerRuntimeCoreState(context).activeMinions || {}).reduce(
        (total: number, count: number) =>
          total +
          Number(count || 0) * Number(necromancerBalanceProfile(context, PROFILE.fleshOfTheMaster)?.resourceGain || 2),
        0
      )
    : 0;
  const carapace = Math.min(
    Number(necromancerBalanceProfile(context, PROFILE.fleshOfTheMaster)?.maximumStacks || 30),
    timedCarapace + minionCarapace
  );
  if (hasTrait(context, TRAIT.DEADLY_STRENGTH) && carapace > 0) {
    const perStack = Number(necromancerBalanceProfile(context, PROFILE.deadlyStrength)?.attributePerStack || 10);
    result.power += carapace * perStack;
    result.conditionDamage += carapace * perStack;
  }

  if (hasTrait(context, TRAIT.AWAKEN_THE_PAIN)) {
    const perStack = Number(necromancerBalanceProfile(context, PROFILE.awakenThePain)?.attributePerStack || 10);
    result.power += Number(context.query?.mightStacksAt(context.time, context.runtime, context.event) || 0) * perStack;
  }

  if (!staticRulesApplied) {
    if (hasTrait(context, TRAIT.SPITEFUL_FORTITUDE)) {
      result.vitality +=
        gearPower * Number(necromancerBalanceProfile(context, PROFILE.spitefulFortitude)?.attributeConversion || 0.1);
    }

    if (hasTrait(context, TRAIT.FURIOUS_DEMISE)) {
      result.precision += Number(necromancerBalanceProfile(context, PROFILE.furiousDemise)?.attributeBonus || 180);
    }

    if (hasTrait(context, TRAIT.TARGET_THE_WEAK)) {
      // Flat Precision from Furious Demise is present before the conversion.
      result.conditionDamage += Math.floor(
        result.precision *
          Number(necromancerBalanceProfile(context, PROFILE.targetTheWeak)?.attributeConversion || 0.13)
      );
    }

    if (hasTrait(context, TRAIT.LINGERING_CURSE)) {
      result.conditionDamage += Number(
        necromancerBalanceProfile(context, PROFILE.lingeringCurse)?.attributeBonus || 200
      );
    }

    if (hasTrait(context, TRAIT.VITAL_PERSISTENCE)) {
      result.vitality += Number(necromancerBalanceProfile(context, PROFILE.vitalPersistence)?.attributeBonus || 180);
    }
  }

  return result;
}

export const necromancerCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'necromancer.life-siphon-bleeding-target',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.5,
    order: 100,
    when: (context) =>
      Boolean(
        necromancerEventSkill(context)?.id === ID.LIFE_SIPHON && necromancerTargetHasCondition(context, 'Bleeding')
      )
  },
  {
    id: 'necromancer.target-the-weak-critical-chance',
    label: 'Target the Weak',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    parameters: { criticalChancePerCondition: 0.02 } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      necromancerTargetConditionCount(context) * parameters.criticalChancePerCondition,
    when: (context) => hasTrait(context, TRAIT.TARGET_THE_WEAK)
  },
  {
    id: 'necromancer.death-perception-critical-chance',
    label: 'Death Perception',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.15,
    when: (context) => hasTrait(context, TRAIT.DEATH_PERCEPTION)
  },
  {
    id: 'necromancer.soul-barbs',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      Boolean(
        hasTrait(context, TRAIT.SOUL_BARBS) && context.timeline?.timedActive('necromancer-soul-barbs', context.time)
      )
  },
  {
    id: 'necromancer.dread',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.2,
    when: (context) =>
      hasTrait(context, TRAIT.DREAD) && Number(necromancerRuntimeCoreState(context).dreadUntil || 0) > context.time
  },
  {
    id: 'necromancer.death-perception-critical-hit-damage',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { criticalHitFactor: 1.1 } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => necromancerCriticalExpectedFactor(context, parameters.criticalHitFactor),
    order: 100,
    when: (context) => hasTrait(context, TRAIT.DEATH_PERCEPTION) && Boolean(necromancerActiveShroud(context))
  },
  {
    id: 'necromancer.spiteful-talisman',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { boonlessFactor: 1.05, boonedFactor: 1.03 } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) =>
      context.config?.target?.boonless ? parameters.boonlessFactor : parameters.boonedFactor,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.SPITEFUL_TALISMAN)
  },
  {
    id: 'necromancer.close-to-death',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.CLOSE_TO_DEATH) && necromancerTargetHealthFraction(context) < 0.5
  },
  {
    id: 'necromancer.necromantic-corruption',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    order: 100,
    when: (context) =>
      Boolean(context.event?.summonKind === 'minion' && hasTrait(context, TRAIT.NECROMANTIC_CORRUPTION))
  },
  {
    id: 'necromancer.putrid-defense',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    order: 100,
    when: (context) => context.condition === 'Poisoned' && hasTrait(context, TRAIT.PUTRID_DEFENSE)
  },
  {
    id: 'necromancer.barbed-precision-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'multiply',
    factor: 1.2,
    when: (context) =>
      context.condition === 'Bleeding' &&
      hasTrait(context, TRAIT.BARBED_PRECISION) &&
      !professionStaticRulesApplied(context.config)
  }
]);

export function compileNecromancerModifierRules(rules: readonly Gw2ModifierRule[]) {
  return createModifierHooks({ rules });
}

function modifyNecromancerCoreRechargeDuration(context: NecromancerRechargeModifierContext, duration: number): number {
  let result = duration;
  const skill = context.skill;
  if (skill?.rechargeOnMinionDeath && !context.minionDeathRecharge) return 0;
  if (skill?.categories?.includes('Corruption') && hasTrait(context, TRAIT.MASTER_OF_CORRUPTION)) {
    result *= 0.67;
  }

  if ((skill?.shroud || skill?.handlerId === 'necromancer.shade') && hasTrait(context, TRAIT.SINISTER_SHROUD)) {
    result *= 0.85;
  }

  return result;
}

function modifyNecromancerConditionBaseDuration(context: Gw2ModifierContext, duration: number): number {
  return necromancerEventSkill(context)?.weapon === 'Scepter' &&
    context.event?.skillId !== ID.DEVOURING_DARKNESS &&
    hasTrait(context, TRAIT.LINGERING_CURSE)
    ? duration * Number(necromancerBalanceProfile(context, PROFILE.lingeringCurse)?.durationMultiplier || 1.5)
    : duration;
}

function modifyNecromancerRechargeStart(
  context: {
    readonly skill?: NecromancerSkill;
    readonly start: number;
  },
  rechargeStart: number
): number {
  if (context.skill?.id !== ID.ISOLATE || context.skill.flipActivationAtMs == null) return rechargeStart;
  const baseCastMs = Number(context.skill.castTimeMs || 0);
  const activationProgress = baseCastMs > 0 ? Number(context.skill.flipActivationAtMs) / baseCastMs : 1;
  return context.start + (rechargeStart - context.start) * activationProgress;
}

export const necromancerCoreAttributeRules = Object.freeze({
  modifyAttributes: modifyNecromancerCoreAttributes,
  modifyConditionBaseDuration: modifyNecromancerConditionBaseDuration,
  modifierRules: necromancerCoreModifierRules,
  compileModifierRules: compileNecromancerModifierRules
});

export const necromancerCoreCastRules = Object.freeze({
  ...necromancerCastRules,
  modifyRechargeDuration: modifyNecromancerCoreRechargeDuration,
  modifyRechargeStart: modifyNecromancerRechargeStart
});

export { necromancerCoreSkillMechanicHandlers, necromancerSchedulerHooks };
export { snapshotNecromancerState } from './state.js';

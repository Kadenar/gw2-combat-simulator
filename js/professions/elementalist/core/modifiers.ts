import { createModifierHooks, MODIFIER_TARGET } from '../../../platform/gw2/combat/modifiers/rules.js';
import { isGw2PlayerModifierEligibleEvent } from '../../../platform/gw2/combat/state/event-ownership.js';
import { hasTrait } from '../../../platform/gw2/combat/state/traits.js';
import { targetConditionActive, targetHealthFraction } from '../../../platform/gw2/combat/query/runtime-query.js';
import { readProfessionCoreState } from '../../../platform/engine/profession/state.js';
import type { SchedulerRecord } from '../../../platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../platform/gw2/combat/modifiers/types.js';
import type { ElementalistAttunement, ElementalistCoreState } from './state.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE, elementalistBalanceValue } from './profiles.js';

function coreState(context: Gw2ModifierContext): Partial<ElementalistCoreState> {
  return readProfessionCoreState<ElementalistCoreState>(context.runtime?.profession);
}

export function elementalistAttunements(context: Gw2ModifierContext): Set<string> {
  const state = coreState(context);
  return new Set([state.primaryAttunement].filter((value): value is ElementalistAttunement => value != null));
}

function primaryAttunement(context: Gw2ModifierContext): ElementalistAttunement | string {
  return coreState(context).primaryAttunement || String(context.config?.startAttunement || 'Fire');
}

function eventWeapon(context: Gw2ModifierContext): string {
  return String(context.event?.skillWeapon || context.event?.weapon || '');
}

export function elementalistMightStacks(context: Gw2ModifierContext): number {
  return Number(
    context.query?.mightStacksAt(context.time, context.runtime, context.event) ?? context.config?.boons?.might ?? 0
  );
}

export function elementalistTimedBuffStacks(context: Gw2ModifierContext, kind: string, maximum = 25): number {
  const applications = context.runtime?.boons?.get(kind) || [];
  return Math.min(
    maximum,
    applications
      .filter((application) => application.at <= context.time && application.expiresAt > context.time)
      .reduce((sum, application) => sum + Number(application.stacks || 1), 0)
  );
}

function infernoBurningFactor(
  context: Gw2ModifierContext,
  _target: string,
  parameters: Readonly<Record<string, number>>
): number {
  const stats = context.query?.statsAt(context.time, context.event, context.runtime);
  const power = Number(stats?.power || 0);
  const conditionDamage = Number(stats?.conditionDamage || 0);
  const normalBurningRate = parameters.conditionBase + parameters.conditionScaling * conditionDamage;
  return normalBurningRate > 0
    ? (parameters.powerBase + parameters.powerScaling * power) / normalBurningRate
    : parameters.fallbackFactor;
}

export const elementalistCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'elementalist.inferno',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    parameters: {
      conditionBase: 131,
      conditionScaling: 0.155,
      powerBase: 131,
      powerScaling: 0.0825,
      fallbackFactor: 1
    } as Readonly<Record<string, number>>,
    factor: infernoBurningFactor,
    when: (context) => hasTrait(context, 'Inferno') && context.condition === 'Burning'
  },
  {
    id: 'elementalist.bountiful-power',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.2,
    when: (context) =>
      hasTrait(context, 'Bountiful Power') && elementalistTimedBuffStacks(context, 'bountiful power active', 1) > 0
  },
  {
    id: 'elementalist.persisting-flames',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    parameters: { maximumStacks: 5, damagePerStack: 0.02 } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      elementalistTimedBuffStacks(context, 'persisting flames', parameters.maximumStacks) * parameters.damagePerStack,
    when: (context) => hasTrait(context, 'Persisting Flames')
  },
  {
    id: 'elementalist.pyromancers-training',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.07,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, "Pyromancer's Training") &&
      targetConditionActive(context, 'Burning')
  },
  {
    id: 'elementalist.serrated-stones',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.05,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, 'Serrated Stones') &&
      targetConditionActive(context, 'Bleeding')
  },
  {
    id: 'elementalist.stormsoul',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.07,
    when: (context) => isGw2PlayerModifierEligibleEvent(context.event) && hasTrait(context, 'Stormsoul')
  },
  {
    id: 'elementalist.flow-like-water',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) => isGw2PlayerModifierEligibleEvent(context.event) && hasTrait(context, 'Flow like Water')
  },
  {
    id: 'elementalist.bolt-to-the-heart',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, 'Bolt to the Heart') &&
      targetHealthFraction(context) <= 0.5
  },
  {
    id: 'elementalist.piercing-shards',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { waterFactor: 1.14, otherFactor: 1.07 } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) =>
      primaryAttunement(context) === 'Water' ? parameters.waterFactor : parameters.otherFactor,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, 'Piercing Shards') &&
      targetConditionActive(context, 'Vulnerability')
  },
  {
    id: 'elementalist.zephyrs-speed-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.05,
    when: (context) => isGw2PlayerModifierEligibleEvent(context.event) && hasTrait(context, "Zephyr's Speed")
  },
  {
    id: 'elementalist.electric-discharge-critical-damage',
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'multiply',
    factor: 2,
    when: (context) => String(context.event?.skillName || context.event?.name || '') === 'Electric Discharge'
  },
  {
    id: 'elementalist.hammer-fire-orb',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.05,
    when: (context) => elementalistTimedBuffStacks(context, 'hammer fire orb', 1) > 0
  },
  {
    id: 'elementalist.hammer-air-orb',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.15,
    when: (context) => elementalistTimedBuffStacks(context, 'hammer air orb', 1) > 0
  },
  {
    id: 'elementalist.frost-bow-condition-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'multiply',
    factor: 1.2,
    when: (context) => eventWeapon(context) === 'Frost Bow'
  }
]);

export function compileElementalistModifierRules(rules: readonly Gw2ModifierRule[]) {
  return createModifierHooks({ rules });
}

// Apply live attunement, timed-buff, conjure, and signet attribute changes at
// event time; build-time bonuses are intentionally handled upstream.
export function modifyElementalistAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord
): SchedulerRecord {
  const modified = { ...attributes };
  const primary = primaryAttunement(context);
  if (hasTrait(context, 'Empowering Flame') && primary === 'Fire') {
    modified.power =
      Number(modified.power || 0) + elementalistBalanceValue(context, PROFILE.empoweringFlame, 'attributeBonus', 150);
  }

  if (
    hasTrait(context, 'Power Overwhelming') &&
    elementalistMightStacks(context) >=
      elementalistBalanceValue(context, PROFILE.powerOverwhelming, 'minimumStacks', 10)
  ) {
    modified.power =
      Number(modified.power || 0) +
      (primary === 'Fire'
        ? elementalistBalanceValue(context, PROFILE.powerOverwhelming, 'weaponAttributeBonus', 300)
        : elementalistBalanceValue(context, PROFILE.powerOverwhelming, 'attributeBonus', 150));
  }

  if (hasTrait(context, 'Fresh Air') && elementalistTimedBuffStacks(context, 'fresh air', 1) > 0) {
    modified.ferocity =
      Number(modified.ferocity || 0) + elementalistBalanceValue(context, PROFILE.freshAir, 'attributeBonus', 250);
  }

  if (hasTrait(context, "Aeromancer's Training") && primary === 'Air') {
    modified.ferocity =
      Number(modified.ferocity || 0) +
      elementalistBalanceValue(context, PROFILE.aeromancersTraining, 'attributeBonus', 150);
  }

  if (
    hasTrait(context, 'Raging Storm') &&
    Boolean(context.query?.furyActiveAt(context.time, context.runtime, context.event))
  ) {
    modified.ferocity =
      Number(modified.ferocity || 0) + elementalistBalanceValue(context, PROFILE.ragingStorm, 'attributeBonus', 180);
  }

  if (hasTrait(context, 'Arcane Lightning') && elementalistTimedBuffStacks(context, 'arcane lightning', 1) > 0) {
    modified.ferocity =
      Number(modified.ferocity || 0) +
      elementalistBalanceValue(context, PROFILE.arcaneLightning, 'attributeBonus', 150);
  }

  const weapon = eventWeapon(context);
  if (weapon === 'Fiery Greatsword') {
    modified.power =
      Number(modified.power || 0) +
      elementalistBalanceValue(context, PROFILE.fieryGreatsword, 'weaponAttributeBonus', 260);
    modified.conditionDamage =
      Number(modified.conditionDamage || 0) +
      elementalistBalanceValue(context, PROFILE.fieryGreatsword, 'attributeBonus', 180);
  } else if (weapon === 'Lightning Hammer') {
    modified.precision =
      Number(modified.precision || 0) +
      elementalistBalanceValue(context, PROFILE.lightningHammer, 'weaponAttributeBonus', 180);
    modified.ferocity =
      Number(modified.ferocity || 0) + elementalistBalanceValue(context, PROFILE.lightningHammer, 'attributeBonus', 75);
  }

  if (Number(coreState(context).signetOfFireDisabledUntil || 0) > context.time) {
    modified.precision =
      Number(modified.precision || 0) - elementalistBalanceValue(context, PROFILE.signetOfFire, 'attributeBonus', 180);
  }

  return modified;
}

export const elementalistCoreAttributeRules = Object.freeze({
  modifyAttributes: modifyElementalistAttributes,
  modifierRules: elementalistCoreModifierRules,
  compileModifierRules: compileElementalistModifierRules
});

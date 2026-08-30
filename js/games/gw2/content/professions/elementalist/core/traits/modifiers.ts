/**
 * Core Elementalist damage and attribute modifiers.
 *
 * Everything here runs at damage-evaluation time against the runtime snapshot,
 * not at build time: declarative `Gw2ModifierRule`s for strike/condition/crit
 * multipliers, plus `modifyElementalistAttributes` for stat changes that depend
 * on the attunement, timed buffs, or wielded bundle in force at that instant.
 * The shared query helpers are also re-used by the specialization modifier files.
 */
import { createModifierHooks, MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { isGw2PlayerModifierEligibleEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { targetConditionActive, targetHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';
import { readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SchedulerRecord } from '#gw2/platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type {
  ElementalistAttunement,
  ElementalistCoreState
} from '#gw2/content/professions/elementalist/core/state.js';
import {
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE,
  elementalistBalanceValue
} from '#gw2/content/professions/elementalist/core/profiles.js';

// Modifier contexts reach core state through the runtime profession snapshot.
function coreState(context: Gw2ModifierContext): Partial<ElementalistCoreState> {
  return readProfessionCoreState<ElementalistCoreState>(context.runtime?.profession);
}

/**
 * The attunements considered active for modifier purposes. Core has only the
 * primary; Weaver extends the returned set with its secondary attunement.
 */
export function elementalistAttunements(context: Gw2ModifierContext): Set<string> {
  const state = coreState(context);
  return new Set([state.primaryAttunement].filter((value): value is ElementalistAttunement => value != null));
}

// Before any attunement swap is recorded, fall back to the build's start attunement.
function primaryAttunement(context: Gw2ModifierContext): ElementalistAttunement | string {
  return coreState(context).primaryAttunement || String(context.config?.startAttunement || 'Fire');
}

function eventWeapon(context: Gw2ModifierContext): string {
  return String(context.event?.skillWeapon || context.event?.weapon || '');
}

/** Might stacks at the event's instant, falling back to the build's assumed might. */
export function elementalistMightStacks(context: Gw2ModifierContext): number {
  return Number(
    context.query?.mightStacksAt(context.time, context.runtime, context.event) ?? context.config?.boons?.might ?? 0
  );
}

/**
 * Counts stacks of a timed profession buff (Fresh Air, Persisting Flames, orb
 * buffs, specialization windows) that are live at the event's instant.
 */
export function elementalistTimedBuffStacks(context: Gw2ModifierContext, kind: string, maximum = 25): number {
  const applications = context.runtime?.boons?.get(kind) || [];
  return Math.min(
    maximum,
    applications
      .filter((application) => application.at <= context.time && application.expiresAt > context.time)
      .reduce((sum, application) => sum + Number(application.stacks || 1), 0)
  );
}

// Inferno replaces Burning's condition-damage scaling with a power-scaled
// variant; express it as a ratio against the canonical Burning rate so the
// shared condition pipeline stays untouched.
function infernoBurningFactor(
  context: Gw2ModifierContext,
  _target: string,
  parameters: Readonly<Record<string, number>>
): number {
  const stats = context.query?.statsAt(context.time, context.event, context.runtime);
  const power = Number(stats?.power || 0);
  const conditionDamage = Number(stats?.conditionDamage || 0);
  // Only Inferno's power coefficient is balance-authorable; its shared burning formula stays canonical.
  const normalBurningRate = 131 + 0.155 * conditionDamage;
  return normalBurningRate > 0 ? (131 + parameters.powerScaling * power) / normalBurningRate : 1;
}

/**
 * Declarative Core trait and resource modifiers, evaluated per damage event.
 * Each rule's `when` states the exact trait, buff, or target condition it needs.
 */
export const elementalistCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'elementalist.inferno',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    parameters: { powerScaling: 0.0825 } as Readonly<Record<string, number>>,
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

/** Compiles a rule list into the modifier hooks the combat pipeline consumes. */
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

  // Power Overwhelming needs a might threshold, and pays the larger bonus while
  // attuned to Fire.
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

  // Conjured bundles carry their own attribute bonuses only while wielded, so
  // they key off the weapon that produced this event rather than the build.
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

  // Signet of Fire's passive precision is part of the build's baseline stats, so
  // activating the signet is modeled by subtracting it for the recharge window.
  if (Number(coreState(context).signetOfFireDisabledUntil || 0) > context.time) {
    modified.precision =
      Number(modified.precision || 0) - elementalistBalanceValue(context, PROFILE.signetOfFire, 'attributeBonus', 180);
  }

  return modified;
}

/** The Core module's `mechanics.modifiers` registration: attribute pass plus rules. */
export const elementalistCoreAttributeRules = Object.freeze({
  modifyAttributes: modifyElementalistAttributes,
  modifierRules: elementalistCoreModifierRules,
  compileModifierRules: compileElementalistModifierRules
});

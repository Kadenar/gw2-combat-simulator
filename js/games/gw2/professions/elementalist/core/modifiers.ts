import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistModifierContext } from '#gw2/professions/elementalist/types.js';
import type { Gw2MutableStats, Gw2Stats } from '#gw2/platform/combat/types.js';
/**
 * Core Elementalist damage and attribute modifiers.
 *
 * Everything here runs at damage-evaluation time against the runtime snapshot,
 * not at build time: declarative `Gw2ModifierRule`s for strike/condition/crit
 * multipliers, plus `modifyElementalistAttributes` for stat changes that depend
 * on the attunement, timed buffs, or wielded bundle in force at that instant.
 * The shared query helpers are also re-used by the specialization modifier files.
 */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { compileGw2ModifierRules, MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  hasSelectedSkill,
  targetConditionActive,
  targetHealthBelow
} from '#gw2/platform/combat/query/runtime-query.js';
import { readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { ElementalistAttunement, ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';

// Modifier contexts reach core state through the runtime profession snapshot.
function coreState(context: ElementalistModifierContext): Partial<ElementalistCoreState> {
  return readProfessionCoreState<ElementalistCoreState>(context.runtime?.profession);
}

/**
 * The attunements considered active for modifier purposes. Core has only the
 * primary; Weaver extends the returned set with its secondary attunement.
 */
export function elementalistAttunements(context: ElementalistModifierContext): Set<string> {
  const state = coreState(context);
  return new Set([state.primaryAttunement].filter((value): value is ElementalistAttunement => value != null));
}

// Before any attunement swap is recorded, fall back to the build's start attunement.
function primaryAttunement(context: ElementalistModifierContext): string {
  return coreState(context).primaryAttunement || context.config?.startAttunement || 'Fire';
}

// Conjure attributes belong to the wielder, including utility attacks, only during the equipped copy's lifetime.
function wieldedConjure(context: ElementalistModifierContext): string | null {
  const state = coreState(context);
  return (state.conjureExpiresAt || 0) > context.time ? state.conjureEquipped || null : null;
}

/** Might stacks at the event's instant, falling back to the build's assumed might. */
export function elementalistMightStacks(context: ElementalistModifierContext): number {
  return Number(
    context.query?.mightStacksAt(context.time, context.runtime, context.event) ?? context.config?.boons?.might ?? 0
  );
}

/**
 * Counts stacks of a timed profession buff (Fresh Air, Persisting Flames, orb
 * buffs, specialization windows) that are live at the event's instant.
 */
export function elementalistTimedBuffStacks(context: ElementalistModifierContext, kind: string, maximum = 25): number {
  const applications = context.runtime?.boons?.get(kind) || [];
  return Math.min(
    maximum,
    applications
      .filter((application) => application.at <= context.time && application.expiresAt > context.time)
      .reduce((sum, application) => sum + (application.stacks || 1), 0)
  );
}

// Inferno replaces Burning's condition-damage scaling with a power-scaled
// variant; express it as a ratio against the canonical Burning rate so the
// shared condition pipeline stays untouched.
function infernoBurningFactor(
  context: ElementalistModifierContext,
  _target: string,
  parameters: Readonly<Record<string, number>>
): number {
  const stats = context.query?.statsAt(context.time, context.event, context.runtime);
  const power = stats?.power || 0;
  const conditionDamage = stats?.conditionDamage || 0;
  // Only Inferno's power coefficient is balance-authorable; its shared burning formula stays canonical.
  const normalBurningRate = 131 + 0.155 * conditionDamage;
  return normalBurningRate > 0 ? (131 + parameters.powerScaling * power) / normalBurningRate : 1;
}

/**
 * Declarative Core trait and resource modifiers, evaluated per damage event.
 * Each rule's `when` states the exact trait, buff, or target condition it needs.
 */
export const elementalistCoreModifierRules = Object.freeze<readonly Gw2ModifierRule[]>([
  {
    id: 'elementalist.inferno',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    parameters: { powerScaling: 0.0825 },
    factor: infernoBurningFactor,
    when: (context) => hasTrait(context, TRAIT.INFERNO) && context.condition === 'Burning'
  },
  {
    id: 'elementalist.bountiful-power',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.2,
    when: (context) =>
      hasTrait(context, TRAIT.BOUNTIFUL_POWER) && elementalistTimedBuffStacks(context, 'bountiful power active', 1) > 0
  },
  {
    id: 'elementalist.persisting-flames',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    parameters: { maximumStacks: 5, damagePerStack: 0.02 },
    amount: (context, _target, parameters) =>
      elementalistTimedBuffStacks(context, 'persisting flames', parameters.maximumStacks) * parameters.damagePerStack,
    when: (context) => hasTrait(context, TRAIT.PERSISTING_FLAMES)
  },
  {
    id: 'elementalist.pyromancers-training',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.07,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.PYROMANCERS_TRAINING) &&
      targetConditionActive(context, 'Burning')
  },
  {
    id: 'elementalist.serrated-stones',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.05,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.SERRATED_STONES) &&
      targetConditionActive(context, 'Bleeding')
  },
  {
    id: 'elementalist.stormsoul',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.07,
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.STORMSOUL)
  },
  {
    id: 'elementalist.flow-like-water',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.FLOW_LIKE_WATER)
  },
  {
    id: 'elementalist.bolt-to-the-heart',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.BOLT_TO_THE_HEART) &&
      targetHealthBelow(context, 0.5)
  },
  {
    id: 'elementalist.piercing-shards',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { waterFactor: 1.14, otherFactor: 1.07 },
    factor: (context, _target, parameters) =>
      primaryAttunement(context) === 'Water' ? parameters.waterFactor : parameters.otherFactor,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.PIERCING_SHARDS) &&
      targetConditionActive(context, 'Vulnerability')
  },
  {
    id: 'elementalist.zephyrs-speed-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ZEPHYRS_SPEED), 'criticalChance'),
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.ZEPHYRS_SPEED)
  },
  {
    id: 'elementalist.electric-discharge-critical-damage',
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'multiply',
    factor: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ELECTRIC_DISCHARGE), 'criticalDamage'),
    when: (context) => (context.event?.skillName || context.event?.name || '') === 'Electric Discharge'
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
    when: (context) => wieldedConjure(context) === 'Frost Bow'
  }
]);

// Apply live attunement, timed-buff, conjure, and signet attribute changes at
// event time; build-time bonuses are intentionally handled upstream.
export function modifyElementalistAttributes(context: ElementalistModifierContext, attributes: Gw2Stats): Gw2Stats {
  const modified: Gw2MutableStats = { ...attributes };
  const primary = primaryAttunement(context);
  if (hasTrait(context, TRAIT.EMPOWERING_FLAME) && primary === 'Fire') {
    const empoweringFlameProfile = requireBalanceProfileFromContext(context, PROFILE.empoweringFlame);
    modified.power = (modified.power || 0) + balanceProfileNumber(empoweringFlameProfile, 'attributeBonus');
  }

  // Power Overwhelming needs a might threshold, and pays the larger bonus while
  // attuned to Fire.
  if (
    hasTrait(context, TRAIT.POWER_OVERWHELMING) &&
    elementalistMightStacks(context) >=
      balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.powerOverwhelming), 'minimumStacks')
  ) {
    const powerOverwhelmingProfile = requireBalanceProfileFromContext(context, PROFILE.powerOverwhelming);
    modified.power =
      (modified.power || 0) +
      (primary === 'Fire'
        ? balanceProfileNumber(powerOverwhelmingProfile, 'weaponAttributeBonus')
        : balanceProfileNumber(powerOverwhelmingProfile, 'attributeBonus'));
  }

  if (hasTrait(context, TRAIT.FRESH_AIR) && elementalistTimedBuffStacks(context, 'fresh air', 1) > 0) {
    const freshAirProfile = requireBalanceProfileFromContext(context, PROFILE.freshAir);
    modified.ferocity = (modified.ferocity || 0) + balanceProfileNumber(freshAirProfile, 'attributeBonus');
  }

  if (hasTrait(context, TRAIT.AEROMANCERS_TRAINING) && primary === 'Air') {
    const aeromancersTrainingProfile = requireBalanceProfileFromContext(context, PROFILE.aeromancersTraining);
    modified.ferocity = (modified.ferocity || 0) + balanceProfileNumber(aeromancersTrainingProfile, 'attributeBonus');
  }

  if (
    hasTrait(context, TRAIT.RAGING_STORM) &&
    Boolean(context.query?.furyActiveAt(context.time, context.runtime, context.event))
  ) {
    const ragingStormProfile = requireBalanceProfileFromContext(context, PROFILE.ragingStorm);
    modified.ferocity = (modified.ferocity || 0) + balanceProfileNumber(ragingStormProfile, 'attributeBonus');
  }

  if (hasTrait(context, TRAIT.ARCANE_LIGHTNING) && elementalistTimedBuffStacks(context, 'arcane lightning', 1) > 0) {
    const arcaneLightningProfile = requireBalanceProfileFromContext(context, PROFILE.arcaneLightning);
    modified.ferocity = (modified.ferocity || 0) + balanceProfileNumber(arcaneLightningProfile, 'attributeBonus');
  }

  // Read equipped state at damage resolution so dropping or expiry also removes the bonuses from lingering hits.
  const weapon = wieldedConjure(context);
  if (weapon === 'Fiery Greatsword') {
    const fieryGreatswordProfile = requireBalanceProfileFromContext(context, PROFILE.fieryGreatsword);
    modified.power = (modified.power || 0) + balanceProfileNumber(fieryGreatswordProfile, 'weaponAttributeBonus');
    modified.conditionDamage =
      (modified.conditionDamage || 0) + balanceProfileNumber(fieryGreatswordProfile, 'attributeBonus');
  } else if (weapon === 'Lightning Hammer') {
    const lightningHammerProfile = requireBalanceProfileFromContext(context, PROFILE.lightningHammer);
    modified.precision =
      (modified.precision || 0) + balanceProfileNumber(lightningHammerProfile, 'weaponAttributeBonus');
    modified.ferocity = (modified.ferocity || 0) + balanceProfileNumber(lightningHammerProfile, 'attributeBonus');
  }

  // Remove baseline passive precision during live recharge, including resets, unless Written in Stone preserves it.
  if (
    hasSelectedSkill(context, 'Signet of Fire') &&
    !hasTrait(context, TRAIT.WRITTEN_IN_STONE) &&
    context.timeline?.skillOnCooldownAt(ID.SIGNET_OF_FIRE, context.time)
  ) {
    const signetOfFireProfile = requireBalanceProfileFromContext(context, PROFILE.signetOfFire);
    modified.precision = (modified.precision || 0) - balanceProfileNumber(signetOfFireProfile, 'attributeBonus');
  }

  return modified;
}

/** The Core module's `mechanics.modifiers` registration: attribute pass plus rules. */
export const elementalistCoreModifiers = Object.freeze({
  modifyAttributes: modifyElementalistAttributes,
  modifierRules: elementalistCoreModifierRules,
  compileModifierRules: compileGw2ModifierRules
});

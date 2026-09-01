import {
  balanceProfileFromContext,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { MIGHT_ATTRIBUTE_BONUS_PER_STACK } from '#gw2/platform/combat/query/runtime-rules.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/engineer/data/ids.js';
import {
  activeBoonStacks,
  cloneEngineerAttributes,
  engineerEvent,
  eventSkill
} from '#gw2/content/professions/engineer/core/traits/query-helpers.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS } from '#gw2/content/professions/engineer/core/profiles.js';
import { MECHANIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/engineer/specializations/mechanist/profiles.js';
import { mechanistCastAvailability } from '#gw2/content/professions/engineer/specializations/mechanist/mechanics/availability.js';
import {
  applyEngineerMechCastTraits,
  handleEngineerMechAttack,
  initializeEngineerMech,
  isEngineerMechCommand,
  observeEngineerMechEvent
} from '#gw2/content/professions/engineer/specializations/mechanist/mechanics/mech.js';
import { engineerMechAttributes } from '#gw2/content/professions/engineer/specializations/mechanist/state.js';
import type { SchedulerRecord } from '#gw2/platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type { EngineerRechargeContext } from '#gw2/content/professions/engineer/types.js';

export const mechanistSchedulerHooks = Object.freeze({
  initialize: {
    id: 'engineer.mech-initialize',
    order: 10,
    handler: initializeEngineerMech
  },
  onEventScheduled: {
    id: 'engineer.mech-events',
    order: 10,
    handler: observeEngineerMechEvent
  },
  afterCast: {
    id: 'engineer.mech-traits',
    order: 30,
    handler: applyEngineerMechCastTraits
  },
  taskHandlers: Object.freeze({
    'engineer.mech-attack': handleEngineerMechAttack
  })
});

export const { afterCast: mechanistAfterCast, ...mechanistAdvancedSchedulerHooks } = mechanistSchedulerHooks;

/** Recognizes native and replayed events that belong to the jade mech. */
function engineerMechEvent(context: Gw2ModifierContext): boolean {
  const event = engineerEvent(context);
  if (event?.metadata?.engineerMech === true || event?.application?.metadata?.engineerMech === true) {
    return true;
  }

  if (context.config?.specialization !== 'Mechanist' || event?.actorType !== 'summon') {
    return false;
  }

  const slot = Number(eventSkill(context)?.mechanicSlot || 0);
  return slot >= 1 && slot <= 3;
}

/** Checks the normalized active loadout for a named Mechanist signet. */
function selectedSignet(context: Gw2ModifierContext, name: string): boolean {
  return selectedSkillNameSet(context.config?.selectedSkills).has(name);
}

/** Requires both J-Drive and the named signet for J-Drive's passive modifiers. */
function jDriveSignet(context: Gw2ModifierContext, name: string): boolean {
  return hasTrait(context, TRAIT.MECH_CORE_J_DRIVE) && selectedSignet(context, name);
}

export const mechanistModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'engineer.force-signet',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    parameters: {
      baseBonus: 0.15,
      jDriveBonus: 0.18
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      hasTrait(context, TRAIT.MECH_CORE_J_DRIVE)
        ? balanceProfileValueFromContext(context, PROFILE.forceSignet, 'activeDamageIncrease', parameters.jDriveBonus)
        : balanceProfileValueFromContext(context, PROFILE.forceSignet, 'damageIncrease', parameters.baseBonus),
    when: (context) => selectedSignet(context, 'Force Signet')
  },
  {
    id: 'engineer.j-drive-superconducting-signet',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.12,
    when: (context) => jDriveSignet(context, 'Superconducting Signet')
  },
  {
    id: 'engineer.mech-base-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.05,
    when: (context) => engineerMechEvent(context) && !hasTrait(context, TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR)
  },
  {
    id: 'engineer.jade-cannons-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    parameters: {
      criticalChance: 0.2
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      balanceProfileValueFromContext(context, PROFILE.jadeCannons, 'criticalChance', parameters.criticalChance),
    when: (context) => engineerMechEvent(context) && hasTrait(context, TRAIT.MECH_ARMS_JADE_CANNONS)
  }
]);

/** Replaces player attributes with the mech's inherited attribute set for mech-owned events. */
function modifyMechanistAttributes(context: Gw2ModifierContext, attributes: SchedulerRecord): SchedulerRecord {
  const modified = cloneEngineerAttributes(attributes);
  if (!engineerMechEvent(context)) return modified;
  const mightStacks = activeBoonStacks(context, 'might');
  // The mech inherits base player stats, not boon-amplified ones. Strip might
  // and fury bonuses before feeding into engineerMechAttributes so the mech's
  // stat formula starts from raw gear values. Shift Signet is the exception:
  // its passive re-applies might bonuses directly to the mech afterward.
  const inheritedSource = {
    ...modified,
    power: Math.max(0, Number(modified.power || 0) - mightStacks * MIGHT_ATTRIBUTE_BONUS_PER_STACK),
    ferocity: Math.max(
      0,
      Number(modified.ferocity || 0) -
        (hasTrait(context, TRAIT.NO_SCOPE) && activeBoonStacks(context, 'fury', 1) > 0
          ? balanceProfileValueFromContext(context, ENGINEER_CORE_BALANCE_PROFILE_IDS.noScope, 'attributeBonus', 150)
          : 0)
    ),
    conditionDamage: Math.max(0, Number(modified.conditionDamage || 0) - mightStacks * MIGHT_ATTRIBUTE_BONUS_PER_STACK)
  };
  const mech = engineerMechAttributes(
    context.config,
    inheritedSource,
    balanceProfileFromContext(context, PROFILE.resources)
  );
  if (selectedSignet(context, 'Shift Signet')) {
    mech.power += mightStacks * MIGHT_ATTRIBUTE_BONUS_PER_STACK;
    mech.conditionDamage += mightStacks * MIGHT_ATTRIBUTE_BONUS_PER_STACK;
  }

  return mech;
}

/** Applies Jade Dynamo and Overclock/J-Drive recharge reductions to eligible Mechanist skills. */
function modifyMechanistRechargeDuration(context: EngineerRechargeContext, duration: number): number {
  const skill = context.skill;
  if (isEngineerMechCommand(skill) && hasTrait(context.config, TRAIT.MECH_CORE_JADE_DYNAMO)) {
    return duration * balanceProfileValueFromContext(context, PROFILE.jadeDynamo, 'rechargeMultiplier', 0.8);
  }

  // Overclock Signet passively reduces other signet recharges while selected
  // and ready; J-Drive keeps the passive active while Overclock is recharging.
  if (
    skill?.id !== ID.OVERCLOCK_SIGNET &&
    skill?.categories?.some((category) => String(category).toLowerCase() === 'signet')
  ) {
    const overclockReadyAt = Number(context.state?.cooldowns?.get(ID.OVERCLOCK_SIGNET) || 0);
    const jDrive = hasTrait(context.config, TRAIT.MECH_CORE_J_DRIVE);
    if (
      selectedSkillNameSet(context.config?.selectedSkills).has('Overclock Signet') &&
      (jDrive || overclockReadyAt <= Number(context.start || 0))
    ) {
      // J-Drive stacks its own 5% reduction on top of Overclock Signet's 20%,
      // yielding 0.8 × 0.95 = 0.76 combined cooldown multiplier.
      return duration * (jDrive ? 0.76 : 0.8);
    }
  }

  return duration;
}

export const mechanistAttributeRules = Object.freeze({
  modifyAttributes: modifyMechanistAttributes,
  modifierRules: mechanistModifierRules
});

export const mechanistCastRules = Object.freeze({
  availability: {
    id: 'engineer.mechanist-availability',
    order: 30,
    handler: mechanistCastAvailability
  },
  modifyRechargeDuration: modifyMechanistRechargeDuration
});

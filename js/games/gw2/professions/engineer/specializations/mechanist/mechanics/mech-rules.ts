import type { Gw2MutableStats, Gw2Stats } from '#gw2/platform/combat/types.js';
import { isEngineerMechEvent } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-ownership.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { MIGHT_ATTRIBUTE_BONUS_PER_STACK } from '#gw2/platform/combat/boons.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { activeBoonStacks, engineerEvent, eventSkill } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/engineer/core/profiles.js';
import { MECHANIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/mechanist/profiles.js';
import { mechanistCastAvailability } from '#gw2/professions/engineer/specializations/mechanist/mechanics/availability.js';
import {
  applyEngineerMechCastTraits,
  engineerMechHasQuickness,
  mechActions,
  initializeEngineerMech,
  isEngineerMechCommand,
  observeEngineerMechEvent
} from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech.js';
import { summonQuicknessCastTimeMs } from '#gw2/platform/skills/timing.js';
import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { engineerMechAttributes, mechanistState } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import type {
  EngineerPrecastContext,
  EngineerRechargeContext,
  EngineerSchedulerContext
} from '#gw2/professions/engineer/types.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';

/** Applies mech cast traits after the skill's effects have been emitted. */
export const mechanistAfterCast = Object.freeze({
  id: 'engineer.mech-traits',
  order: 30,
  handler: applyEngineerMechCastTraits
});

export const mechanistAdvancedSchedulerHooks = Object.freeze({
  prepareEvent: {
    id: 'engineer.mech-boon-audience',
    order: 10,
    handler: (context: EngineerSchedulerContext, event: SimulationEventBase) =>
      prepareGw2BuffCompanionCandidates(event, mechanistState.from(context).mech.active ? ['engineer.mech'] : [])
  },
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
  taskHandlers: mechActions.taskHandlers
});

/** Recognizes native and replayed events that belong to the jade mech. */
function engineerMechEvent(context: Gw2ModifierContext): boolean {
  return isEngineerMechEvent(
    engineerEvent(context),
    () => eventSkill(context),
    context.config?.specialization === 'Mechanist'
  );
}

/** Checks the normalized active loadout for a named Mechanist signet. */
function selectedSignet(context: Gw2ModifierContext, name: string): boolean {
  return selectedSkillNameSet(context.config?.selectedSkills).has(name);
}

export const mechanistModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'engineer.force-signet',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: (context) => {
      const forceSignetProfile = requireBalanceProfileFromContext(context, PROFILE.forceSignet);
      return hasTrait(context, TRAIT.MECH_CORE_J_DRIVE)
        ? balanceProfileNumber(forceSignetProfile, 'activeDamageIncrease')
        : balanceProfileNumber(forceSignetProfile, 'damageIncrease');
    },
    when: (context) =>
      selectedSignet(context, 'Force Signet') &&
      (hasTrait(context, TRAIT.MECH_CORE_J_DRIVE) ||
        !context.timeline?.skillOnCooldownAt(ID.FORCE_SIGNET, context.time))
  },
  {
    id: 'engineer.superconducting-signet',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    // Ordinary signets lose their passive on recharge; J-Drive retains and improves it.
    amount: (context) => (hasTrait(context, TRAIT.MECH_CORE_J_DRIVE) ? 0.12 : 0.1),
    when: (context) =>
      selectedSignet(context, 'Superconducting Signet') &&
      (hasTrait(context, TRAIT.MECH_CORE_J_DRIVE) ||
        !context.timeline?.skillOnCooldownAt(ID.SUPERCONDUCTING_SIGNET, context.time))
  },
  {
    id: 'engineer.mech-base-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'criticalChance'),
    when: (context) => engineerMechEvent(context) && !hasTrait(context, TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR)
  },
  {
    id: 'engineer.jade-cannons-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',

    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.MECH_ARMS_JADE_CANNONS), 'criticalChance'),
    when: (context) => engineerMechEvent(context) && hasTrait(context, TRAIT.MECH_ARMS_JADE_CANNONS)
  }
]);

/** Replaces player attributes with the mech's inherited attribute set for mech-owned events. */
function modifyMechanistAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const modified: Gw2MutableStats = { ...attributes };
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
          ? balanceProfileNumber(
              requireBalanceProfileFromContext(context, ENGINEER_CORE_BALANCE_PROFILE_IDS.noScope),
              'attributeBonus'
            )
          : 0)
    ),
    conditionDamage: Math.max(0, Number(modified.conditionDamage || 0) - mightStacks * MIGHT_ATTRIBUTE_BONUS_PER_STACK)
  };
  const mech = engineerMechAttributes(
    context.config,
    inheritedSource,
    requireBalanceProfileFromContext(context, PROFILE.resources)
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
    const jadeDynamoProfile = requireBalanceProfileFromContext(context, PROFILE.jadeDynamo);
    return duration * balanceProfileNumber(jadeDynamoProfile, 'rechargeMultiplier');
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
      // J-Drive improves Overclock's 20% passive reduction to 24%.
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
  // Override the player's cast-rate decision only for skills executed by the mech.
  modifyCastDuration(context: EngineerPrecastContext, duration: number): number {
    if (!isEngineerMechCommand(context.skill)) return duration;
    return (
      (engineerMechHasQuickness(context, context.start)
        ? summonQuicknessCastTimeMs(context.skill)
        : Number(context.skill.castTimeMs || 0)) / 1000
    );
  },
  availability: {
    id: 'engineer.mechanist-availability',
    order: 30,
    handler: mechanistCastAvailability
  },
  modifyRechargeDuration: modifyMechanistRechargeDuration
});

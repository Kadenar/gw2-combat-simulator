import { eventSkill } from '#gw2/platform/combat/query/runtime-query.js';
import type { Gw2MutableStats, Gw2Stats } from '#gw2/platform/combat/types.js';
import { isEngineerMechEvent } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-ownership.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import {
  selectedSignet,
  signetModifierRules
} from '#gw2/professions/engineer/specializations/mechanist/skills/signet-skills.js';
import { MIGHT_ATTRIBUTE_BONUS_PER_STACK } from '#gw2/platform/combat/boons.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { activeBoonStacks, engineerEvent } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/engineer/core/profiles.js';
import { MECHANIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/mechanist/profiles.js';
import { engineerMechAttributes } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';

/** Recognizes native and replayed events that belong to the jade mech. */
function engineerMechEvent(context: Gw2ModifierContext): boolean {
  return isEngineerMechEvent(
    engineerEvent(context),
    () => eventSkill(context),
    context.config?.specialization === 'Mechanist'
  );
}

const mechanistModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  ...signetModifierRules,
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
    power: Math.max(0, (modified.power || 0) - mightStacks * MIGHT_ATTRIBUTE_BONUS_PER_STACK),
    ferocity: Math.max(
      0,
      (modified.ferocity || 0) -
        (hasTrait(context, TRAIT.NO_SCOPE) && activeBoonStacks(context, 'fury', 1) > 0
          ? balanceProfileNumber(
              requireBalanceProfileFromContext(context, ENGINEER_CORE_BALANCE_PROFILE_IDS.noScope),
              'attributeBonus'
            )
          : 0)
    ),
    conditionDamage: Math.max(0, (modified.conditionDamage || 0) - mightStacks * MIGHT_ATTRIBUTE_BONUS_PER_STACK)
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

export const mechanistModifiers = Object.freeze({
  modifyAttributes: modifyMechanistAttributes,
  modifierRules: mechanistModifierRules
});

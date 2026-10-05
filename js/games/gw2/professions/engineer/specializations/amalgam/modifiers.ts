import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import {
  activeBoonStacks,
  activeEngineerSpecializationState
} from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { evolveAttributeFactor } from '#gw2/professions/engineer/specializations/amalgam/traits/behavior.js';
import type { EngineerModifierContext } from '#gw2/professions/engineer/types.js';

import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/combat-query.js';
import { AMALGAM_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/amalgam/profiles.js';

// Evolved adds 10% of its eligible stat pool, or 20% with Double Helix.
// Derived armor/crit fields update from toughness, ferocity, and precision.
const EVOLVE_ATTRIBUTES = Object.freeze([
  ['power', 'Power'],
  ['precision', 'Precision'],
  ['toughness', 'Toughness'],
  ['vitality', 'Vitality'],
  ['ferocity', 'Ferocity'],
  ['conditionDamage', 'Condition Damage'],
  ['expertise', 'Expertise'],
  ['concentration', 'Concentration'],
  ['healingPower', 'Healing Power']
] as const);

/** Limits Morph-only modifiers to eligible player strike packets from Morph skills. */

/** Defines Amalgam's event-level strike, condition, and duration modifiers. */
export const amalgamModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    order: 1,
    id: 'engineer.plasmatic-state',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.07,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      activeEngineerSpecializationState(context, 'Amalgam', 'plasmaticStateUntil')
  }
]);

/** Applies Evolve and Titanic bonuses to the player's attributes. */
function modifyAmalgamAttributes(context: EngineerModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const modified = { ...attributes };
  if (activeEngineerSpecializationState(context, 'Amalgam', 'evolvedUntil')) {
    const evolveFactor = evolveAttributeFactor(context);
    const pool = context.config?.amalgamEvolveAttributePool;
    for (const [attribute, poolAttribute] of EVOLVE_ATTRIBUTES) {
      const eligible = pool?.[poolAttribute] ?? modified[attribute];
      const bonus = eligible * (evolveFactor - 1);
      modified[attribute] =
        (modified[attribute] || 0) + (['power', 'conditionDamage'].includes(attribute) ? Math.round(bonus) : bonus);
    }
  }

  if (activeEngineerSpecializationState(context, 'Amalgam', 'titanicUntil')) {
    const strainsProfile = requireBalanceProfileFromContext(context, PROFILE.strains);
    // Titanic Strain adds 5 power + 5 condition damage per might stack on top
    // of the standard 30 power per stack that's already in the base attributes.
    const improvedMight =
      activeBoonStacks(context, 'might') * balanceProfileNumber(strainsProfile, 'attributePerStack');
    modified.power += improvedMight;
    modified.conditionDamage += improvedMight;
  }

  return modified;
}

/** Exposes Amalgam's aggregate attribute transformation and packet modifier rules. */
export const amalgamModifiers = Object.freeze({
  modifyAttributes: modifyAmalgamAttributes,
  modifierRules: amalgamModifierRules
});

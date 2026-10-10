import type { Gw2AttributeContributionCalculator } from '#gw2/platform/builds/types.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import {
  activeBoonStacks,
  activeEngineerSpecializationState
} from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { evolveAttributeFactor } from '#gw2/professions/engineer/specializations/amalgam/traits/behavior.js';

import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
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

/** Evolve reads immutable common inputs; Titanic adds live Might outside conversion eligibility. */
export const amalgamAttributes: Gw2AttributeContributionCalculator = (context) => {
  const evolved = activeEngineerSpecializationState(context, 'Amalgam', 'evolvedUntil');
  const factor = evolved ? evolveAttributeFactor(context) - 1 : 0;
  const titanic = activeEngineerSpecializationState(context, 'Amalgam', 'titanicUntil')
    ? activeBoonStacks(context, 'might') *
      balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.strains), 'attributePerStack')
    : 0;
  return [
    {
      attributeEffects: [
        ...EVOLVE_ATTRIBUTES.map(([attribute, name]) => ({
          kind: 'conversion' as const,
          from: name,
          to: name,
          multiplier: factor,
          input: 'common' as const,
          rounding: ['power', 'conditionDamage'].includes(attribute) ? ('round' as const) : ('none' as const)
        })),
        ...['Power', 'Condition Damage'].map((to) => ({
          kind: 'flat' as const,
          to,
          amount: titanic,
          feedsConversions: false
        }))
      ]
    }
  ];
};

/** Exposes Amalgam's aggregate attribute transformation and packet modifier rules. */
export const amalgamModifiers = Object.freeze({
  modifierRules: amalgamModifierRules
});

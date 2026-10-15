import type { Gw2AttributeContributionCalculator } from '#gw2/platform/builds/types.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import {
  activeBoonStacks,
  activeEngineerSpecializationState
} from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { evolveAttributeFactor } from '#gw2/professions/engineer/specializations/amalgam/traits/index.js';

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
          feedsConversions: 'none' as const
        }))
      ]
    }
  ];
};

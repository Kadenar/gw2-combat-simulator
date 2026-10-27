import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { BOON } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import type { Gw2AttributeContributionCalculator } from '#gw2/platform/attributes/types.js';
import { skillNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { activeBoonStacks } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { activeAmalgamState } from '#gw2/professions/engineer/specializations/amalgam/mechanics/modifier-queries.js';
import { evolveAttributeFactor } from '#gw2/professions/engineer/specializations/amalgam/traits/index.js';

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
  const evolved = activeAmalgamState(context, 'evolvedUntil');
  const factor = evolved ? evolveAttributeFactor(context) - 1 : 0;
  const titanic = activeAmalgamState(context, 'titanicUntil')
    ? activeBoonStacks(context, boonKey(BOON.MIGHT)) *
      skillNumberFromContext(context, ID.OFFENSIVE_PROTOCOL_OBLITERATE, 'titanicAttributePerStack')
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

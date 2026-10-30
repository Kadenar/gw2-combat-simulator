import type { Gw2AttributeContributionCalculator } from '#gw2/platform/attributes/types.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { BOON } from '#gw2/platform/constants.js';
import { skillNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { activeBoonStacks } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { activeAmalgamState } from '#gw2/professions/engineer/specializations/amalgam/mechanics/modifier-queries.js';
import { evolveAttributeFactor } from '#gw2/professions/engineer/specializations/amalgam/traits/index.js';

// Evolved adds 10% of its eligible stat pool, or 20% with Double Helix.
// Round attribute conversions before deriving armor, critical chance, and duration percentages.
const EVOLVE_ATTRIBUTES = Object.freeze([
  'Power',
  'Precision',
  'Toughness',
  'Vitality',
  'Ferocity',
  'Condition Damage',
  'Expertise',
  'Concentration',
  'Healing Power'
] as const);

/** Evolve scales conversion-eligible flat traits with equipment; Might and Titanic stay outside that pool. */
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
        ...EVOLVE_ATTRIBUTES.map((name) => ({
          kind: 'conversion' as const,
          from: name,
          to: name,
          multiplier: factor,
          input: 'eligible' as const,
          rounding: 'round' as const
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

import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

/** Owns Life Attunement tuning and behavior at its established execution boundaries. */
export const lifeAttunement = defineTrait({
  buildAttributes: (_common, { balanceContext }) => ({
    attributeEffects: [
      {
        kind: 'flat',
        to: 'Healing Power',
        amount: balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.LIFE_ATTUNEMENT),
          'attributeBonus'
        ),
        feedsConversions: true
      },
      {
        kind: 'conversion',
        from: 'Healing Power',
        to: 'Concentration',
        multiplier: balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.LIFE_ATTUNEMENT),
          'attributeConversion'
        ),
        rounding: 'round',
        input: 'eligible'
      }
    ]
  }),
  id: TRAIT.LIFE_ATTUNEMENT,
  name: 'Life Attunement',
  balance: { attributeConversion: 0.07, attributeBonus: 120 }
});

/** Owns Serene Rejuvenation tuning and behavior at its established execution boundaries. */
export const sereneRejuvenation = defineTrait({
  id: TRAIT.SERENE_REJUVENATION,
  name: 'Serene Rejuvenation',
  balance: {
    effects: [
      {
        type: 'boon',
        boon: 'vigor',
        duration: 2,
        stacks: 1,
        audience: { recipients: 'party', maximumRecipients: 5 },
        metadata: { trigger: String(ID.NATURAL_HARMONY) }
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 1,
        audience: { recipients: 'party', maximumRecipients: 5 },
        metadata: { trigger: String(ID.PURIFYING_ESSENCE) }
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 5,
        stacks: 1,
        audience: { recipients: 'party', maximumRecipients: 5 },
        metadata: { trigger: String(ID.PROTECTIVE_SOLACE) }
      },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 4,
        stacks: 1,
        audience: { recipients: 'party', maximumRecipients: 5 },
        metadata: { trigger: String(ID.ENERGY_EXPULSION) }
      }
    ]
  }
});

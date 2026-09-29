import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

/** Earth definitions keep active tuning beside their behavior; explicit calls preserve mechanic ordering. */
export const earthsEmbrace = defineTrait({
  id: TRAIT.EARTHS_EMBRACE,
  name: "Earth's Embrace",
  balance: {
    internalCooldown: 15,
    effects: [{ type: 'boon', name: 'Resistance', boon: 'resistance', stacks: 1, duration: 4 }]
  }
});

export const serratedStones = defineTrait({
  id: TRAIT.SERRATED_STONES,
  name: 'Serrated Stones',
  balance: { durationMultiplier: 20 },
  modifierRules: [
    {
      order: -9,
      id: 'elementalist.serrated-stones',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.05,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetConditionActive(context, 'Bleeding')
    }
  ],
  buildAttributes: (_common, { balanceContext }) => ({
    traitDurations: {
      'Bleeding Duration': balanceProfileNumber(
        requireBalanceProfileFromContext(balanceContext, TRAIT.SERRATED_STONES),
        'durationMultiplier'
      )
    }
  })
});

export const elementalShielding = defineTrait({
  id: TRAIT.ELEMENTAL_SHIELDING,
  name: 'Elemental Shielding',
  balance: {
    effects: [{ type: 'boon', name: 'Protection', boon: 'protection', stacks: 1, duration: 3 }]
  }
});

export const earthenBlast = defineTrait({
  id: TRAIT.EARTHEN_BLAST,
  name: 'Earthen Blast',
  balance: {
    effects: [{ name: 'Earthen Blast', type: 'strike', coefficient: 0.36, hits: 1 }]
  }
});

export const strengthOfStone = defineTrait({
  id: TRAIT.STRENGTH_OF_STONE,
  name: 'Strength of Stone',
  balance: {
    attributeConversion: 0.1,
    internalCooldown: 3,
    effects: [{ type: 'condition', name: 'Strength of Stone', condition: 'Bleeding', stacks: 3, duration: 10 }]
  },
  buildAttributes: (_common, { balanceContext }) => {
    const profile = requireBalanceProfileFromContext(balanceContext, TRAIT.STRENGTH_OF_STONE);
    return {
      attributeEffects: [
        {
          kind: 'conversion',
          from: 'Toughness',
          to: 'Condition Damage',
          multiplier: balanceProfileNumber(profile, 'attributeConversion'),
          rounding: 'round',
          input: 'common'
        }
      ]
    };
  }
});

export const rockSolid = defineTrait({
  id: TRAIT.ROCK_SOLID,
  name: 'Rock Solid',
  balance: {
    effects: [{ type: 'boon', name: 'Stability', boon: 'stability', stacks: 1, duration: 3 }]
  }
});

export const geomancersTraining = defineTrait({
  id: TRAIT.GEOMANCERS_TRAINING,
  name: "Geomancer's Training",
  balance: { rechargeMultiplier: 0.8 }
});

export const writtenInStone = defineTrait({
  id: TRAIT.WRITTEN_IN_STONE,
  name: 'Written in Stone',
  balance: {
    effects: [
      { type: 'buff', name: 'Restoration', kind: 'Frost Aura', stacks: 1, duration: 4 },
      { type: 'buff', name: 'Fire', kind: 'Fire Aura', stacks: 1, duration: 4 },
      { type: 'buff', name: 'Earth', kind: 'Magnetic Aura', stacks: 1, duration: 3 }
    ]
  }
});

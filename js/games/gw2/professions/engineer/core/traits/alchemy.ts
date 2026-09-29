import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { isElixirSkill, prepareEngineerHghEvent } from '#gw2/professions/engineer/core/traits/behavior.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';

/** Owns HGH tuning and behavior at its established runtime and build boundaries. */
export const hgh = defineTrait({
  id: TRAIT.HGH,
  name: 'HGH',
  balance: {
    durationMultiplier: 1.2,
    effects: [
      { name: 'might', type: 'boon', boon: 'might', stacks: 2, duration: 12 },
      { name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 4 },
      { name: 'HGH', type: 'strike', coefficient: 0.85, hits: 1, packetLabel: 'additional Acid Bomb strike' }
    ]
  },
  triggers: ['might', 'fury'].map((boon) => ({
    on: 'castCommit',
    when: (_runtime, cast) => isElixirSkill(cast.skill),
    emit: TRAIT.HGH,
    effects: (effect) => effect.type === 'boon' && effect.name === boon,
    attribution: { source: 'Trait', sourceId: TRAIT.HGH, actorType: 'player', name: `HGH — ${boon}` }
  })),
  hooks: { prepareEvent: prepareEngineerHghEvent }
});

/** Owns Compounding Chemicals tuning and behavior at its established runtime and build boundaries. */
export const compoundingChemicals = defineTrait({
  id: TRAIT.COMPOUNDING_CHEMICALS,
  name: 'Compounding Chemicals',
  balance: { attributeBonus: 240 },
  buildAttributes: (_common, { balanceContext: profileContext }) => {
    const compoundingChemicalsProfile = requireBalanceProfileFromContext(profileContext, TRAIT.COMPOUNDING_CHEMICALS);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          source: 'Compounding Chemicals',
          to: 'Concentration',
          amount: balanceProfileNumber(compoundingChemicalsProfile, 'attributeBonus'),
          feedsConversions: false
        }
      ]
    };
  }
});

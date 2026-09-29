import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { rangerActiveBoonCount, rangerPetEvent } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntime } from '#gw2/professions/ranger/types.js';

/** Owns Wellspring's live tuning and trait behavior. */
export const wellspring = defineTrait({
  id: TRAIT.WELLSPRING,
  name: 'Wellspring',
  balance: {
    attributeConversion: 0.07,
    effects: [
      {
        name: 'regeneration',
        type: 'boon',
        boon: 'regeneration',
        duration: 6,
        stacks: 1,
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ]
  },
  triggers: [
    {
      order: 1,
      emit: TRAIT.WELLSPRING,
      on: 'castCommit' as const,
      when: (_runtime: RangerRuntime, cast: RuntimeCast) => cast.skill.type === 'Heal',
      effects: (effect) => effect.type === 'boon' && effect.name === 'regeneration',
      attribution: (_runtime: RangerRuntime, cast: RuntimeCast) => ({
        skillId: TRAIT.WELLSPRING,
        skillName: 'Wellspring',
        name: `Wellspring - regeneration`,
        triggeredBy: cast.skill.name
      })
    }
  ],
  buildAttributes: (_common, { balanceContext }) => ({
    attributeEffects: [
      {
        kind: 'conversion',
        source: 'Wellspring',
        from: 'Power',
        to: 'Healing Power',
        multiplier: balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.WELLSPRING),
          'attributeConversion'
        ),
        rounding: 'none',
        input: 'common'
      }
    ]
  })
});

/** Owns Windborne Notes's live tuning and trait behavior. */
export const windborneNotes = defineTrait({
  id: TRAIT.WINDBORNE_NOTES,
  name: 'Windborne Notes',
  balance: {
    effects: [
      {
        name: 'regeneration',
        type: 'boon',
        boon: 'regeneration',
        duration: 6,
        stacks: 1,
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ]
  },
  triggers: [
    {
      order: 2,
      emit: TRAIT.WINDBORNE_NOTES,
      on: 'castCommit' as const,
      when: (_runtime: RangerRuntime, cast: RuntimeCast) => cast.skill.weapon === 'Warhorn',
      effects: (effect) => effect.type === 'boon' && effect.name === 'regeneration',
      attribution: (_runtime: RangerRuntime, cast: RuntimeCast) => ({
        skillId: TRAIT.WINDBORNE_NOTES,
        skillName: 'Windborne Notes',
        name: `Windborne Notes - regeneration`,
        triggeredBy: cast.skill.name
      })
    }
  ]
});

/** Owns Rejuvenation's live tuning and trait behavior. */
export const rejuvenation = defineTrait({
  id: TRAIT.REJUVENATION,
  name: 'Rejuvenation',
  balance: {
    internalCooldown: 20,
    effects: [{ name: 'regeneration', type: 'boon', boon: 'regeneration', duration: 10, stacks: 1 }]
  }
});

/** Owns Spirited Arrival's live tuning and trait behavior. */
export const spiritedArrival = defineTrait({
  id: TRAIT.SPIRITED_ARRIVAL,
  name: 'Spirited Arrival',
  balance: {
    effects: [
      { name: 'might', type: 'boon', boon: 'might', duration: 12, stacks: 6 },
      { name: 'fury', type: 'boon', boon: 'fury', duration: 8, stacks: 1 }
    ]
  }
});

/** Owns Lingering Magic's live tuning and trait behavior. */
export const lingeringMagic = defineTrait({
  id: TRAIT.LINGERING_MAGIC,
  name: 'Lingering Magic',
  balance: {
    attributeBonus: 240
  },
  buildAttributes: (_common, { balanceContext: profileContext }) => {
    const profile = requireBalanceProfileFromContext(profileContext, TRAIT.LINGERING_MAGIC);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          source: 'Lingering Magic',
          to: 'Concentration',
          amount: balanceProfileNumber(profile, 'attributeBonus'),
          feedsConversions: false
        }
      ]
    };
  }
});

/** Owns Bountiful Hunter's live tuning and trait behavior. */
export const bountifulHunter = defineTrait({
  id: TRAIT.BOUNTIFUL_HUNTER,
  name: 'Bountiful Hunter',
  modifierRules: [
    {
      order: 7,
      id: 'ranger.bountiful-hunter-player',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: { baseFactor: 1, damagePerBoon: 0.01 },
      factor: (context, _target, parameters) =>
        parameters.baseFactor + rangerActiveBoonCount(context, 'player') * parameters.damagePerBoon,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.BOUNTIFUL_HUNTER)
    },
    {
      order: 32,
      id: 'ranger.bountiful-hunter-pet',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: { baseFactor: 1, damagePerBoon: 0.01 },
      factor: (context, _target, parameters) =>
        parameters.baseFactor + rangerActiveBoonCount(context, 'pet') * parameters.damagePerBoon,
      when: (context) => rangerPetEvent(context) && hasTrait(context, TRAIT.BOUNTIFUL_HUNTER)
    }
  ]
});

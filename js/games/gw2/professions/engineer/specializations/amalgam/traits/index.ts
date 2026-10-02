import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import {
  resolveAmalgamSkillId,
  amalgamMaximumAmmo,
  reactToMercurialTendencies,
  morphStrike
} from '#gw2/professions/engineer/specializations/amalgam/traits/behavior.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { activeEngineerSpecializationState } from '#gw2/professions/engineer/core/traits/query-helpers.js';

/** Owns Carbolic Composition tuning and its existing Morph/Evolve contribution. */
export const carbolicComposition = defineTrait({
  id: TRAIT.CARBOLIC_COMPOSITION,
  name: 'Carbolic Composition',
  balance: {
    conditionDurationBonus: 0.33,
    effects: [{ name: 'Poisoned', type: 'condition', condition: 'Poisoned', stacks: 1, duration: 3 }]
  },
  modifierRules: [
    {
      id: 'engineer.carbolic-composition-duration',
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.CARBOLIC_COMPOSITION),
          'conditionDurationBonus'
        ),
      // Panel-derived simulation stats already contain this static bonus; provenance keeps direct simulations compatible.
      when: (context) => context.condition === 'Poisoned' && !professionStaticRulesApplied(context.config)
    }
  ],
  buildAttributes: (_common, { balanceContext }) => ({
    traitDurations: {
      'Poison Duration':
        100 *
        balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.CARBOLIC_COMPOSITION),
          'conditionDurationBonus'
        )
    }
  })
});

/** Owns Double Helix tuning and its existing Morph/Evolve contribution. */
export const doubleHelix = defineTrait({
  id: TRAIT.DOUBLE_HELIX,
  name: 'Double Helix',
  hooks: {
    maximumAmmo: amalgamMaximumAmmo,
    modifySkillId: (runtime, skillId) => resolveAmalgamSkillId(runtime.config, skillId)
  }
});

/** Owns Mercurial Tendencies tuning and its existing Morph/Evolve contribution. */
export const mercurialTendencies = defineTrait({
  id: TRAIT.MERCURIAL_TENDENCIES,
  name: 'Mercurial Tendencies',
  balance: {
    internalCooldown: 0.24,
    rechargeReduction: 2.5
  },
  hooks: { reactions: { 'control.resolved': reactToMercurialTendencies } }
});

/** Owns Hybrid Vigor tuning and its existing Morph/Evolve contribution. */
export const hybridVigor = defineTrait({
  id: TRAIT.HYBRID_VIGOR,
  name: 'Hybrid Vigor',
  balance: { attributeBonus: 240 },
  buildAttributes: traitAttributeEffects(TRAIT.HYBRID_VIGOR, [
    { kind: 'flat', to: 'Vitality', field: 'attributeBonus', feedsConversions: false }
  ])
});

/** Owns Willing Host tuning and its existing Morph/Evolve contribution. */
export const willingHost = defineTrait({
  id: TRAIT.WILLING_HOST,
  name: 'Willing Host',
  balance: {
    durationMultiplier: 10
  },
  modifierRules: [
    {
      id: 'engineer.willing-host',
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      amount: 0.05,
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        activeEngineerSpecializationState(context, 'Amalgam', 'willingHostUntil')
    }
  ]
});

/** Owns Symbiotic Synergy tuning and its existing Morph/Evolve contribution. */
export const symbioticSynergy = defineTrait({
  id: TRAIT.SYMBIOTIC_SYNERGY,
  name: 'Symbiotic Synergy',
  modifierRules: [
    {
      id: 'engineer.symbiotic-synergy',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.33,
      when: (context) => morphStrike(context)
    }
  ]
});

/** Owns Silver Lining tuning and its existing Morph/Evolve contribution. */
export const silverLining = defineTrait({ id: TRAIT.SILVER_LINING, name: 'Silver Lining' });

/** Owns New Genes tuning and its existing Morph/Evolve contribution. */
export const newGenes = defineTrait({
  id: TRAIT.NEW_GENES,
  name: 'New Genes',
  balance: {
    effects: [
      { name: 'alacrity', type: 'boon', boon: 'alacrity', stacks: 1, duration: 5 },
      { name: 'might', type: 'boon', boon: 'might', stacks: 4, duration: 12 },
      { name: 'cleanse', type: 'boon', boon: 'aegis', stacks: 1, duration: 4, metadata: { trigger: 'cleanse' } },
      { name: 'protect', type: 'boon', boon: 'protection', stacks: 1, duration: 4, metadata: { trigger: 'protect' } },
      { name: 'thorns', type: 'boon', boon: 'stability', stacks: 2, duration: 4, metadata: { trigger: 'thorns' } },
      { name: 'demolish', type: 'boon', boon: 'swiftness', stacks: 1, duration: 6, metadata: { trigger: 'demolish' } },
      { name: 'obliterate', type: 'boon', boon: 'might', stacks: 5, duration: 12, metadata: { trigger: 'obliterate' } },
      { name: 'pierce', type: 'boon', boon: 'vigor', stacks: 1, duration: 4, metadata: { trigger: 'pierce' } },
      { name: 'shred', type: 'boon', boon: 'fury', stacks: 1, duration: 6, metadata: { trigger: 'shred' } }
    ]
  }
});

/** Owns Hardened Chrome tuning and its existing Morph/Evolve contribution. */
export const hardenedChrome = defineTrait({
  id: TRAIT.HARDENED_CHROME,
  name: 'Hardened Chrome',
  balance: {
    minimumStacks: 2.5,
    maximumStacks: 4
  }
});

/** Registers amalgam traits in the established gameplay order. */
export const amalgamTraits = [
  willingHost,
  symbioticSynergy,
  carbolicComposition,
  newGenes,
  hardenedChrome,
  hybridVigor,
  mercurialTendencies,
  doubleHelix,
  silverLining
];

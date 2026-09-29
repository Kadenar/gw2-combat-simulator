import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { vulnerabilityStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { isDamagingCondition } from '#gw2/platform/combat/state/targets.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { getActiveTraits } from '#gw2/professions/revenant/data/traits-data.js';
import {
  CONDUIT_BALANCE_PROFILE_IDS,
  CONDUIT_BALANCE_PROFILE_IDS as PROFILE
} from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { TWIN_MOON_SKILL_IDS } from '#gw2/professions/revenant/specializations/conduit/skill-groups.js';
import { bolsteredBondsBonuses } from '#gw2/professions/revenant/specializations/conduit/traits/behavior.js';
import type { RevenantBuild } from '#gw2/professions/revenant/types.js';

/** Owns Bolstered Bonds tuning and behavior at its established execution boundaries. */
export const bolsteredBonds = defineTrait({
  buildAttributes: (_common, { balanceContext, build }) => ({
    attributeEffects: Object.entries(
      bolsteredBondsBonuses(balanceContext, (build as RevenantBuild).selectedLegends)
    ).map(([attribute, amount]) => ({
      kind: 'flat' as const,
      source: 'Bolstered Bonds',
      to: BUILD_ATTRIBUTE_NAMES[attribute as keyof typeof BUILD_ATTRIBUTE_NAMES],
      amount,
      feedsConversions: false
    }))
  }),
  id: TRAIT.BOLSTERED_BONDS,
  name: 'Bolstered Bonds',
  balance: {
    id: TRAIT.BOLSTERED_BONDS,
    assassinAttributeBonus: 75,
    centaurAttributeBonus: 150,
    demonAttributeBonus: 75,
    dwarfAttributeBonus: 150,
    entityAttributeBonus: 75,
    attributeMultiplier: 2
  }
});

const BUILD_ATTRIBUTE_NAMES = Object.freeze({
  power: 'Power',
  precision: 'Precision',
  toughness: 'Toughness',
  vitality: 'Vitality',
  ferocity: 'Ferocity',
  conditionDamage: 'Condition Damage',
  expertise: 'Expertise',
  concentration: 'Concentration',
  healingPower: 'Healing Power'
});

/** Owns Conductive Armaments tuning and behavior at its established execution boundaries. */
export const conductiveArmaments = defineTrait({ id: TRAIT.CONDUCTIVE_ARMAMENTS, name: 'Conductive Armaments' });

/** Owns Enhanced Embodiment tuning and behavior at its established execution boundaries. */
export const enhancedEmbodiment = defineTrait({
  id: TRAIT.ENHANCED_EMBODIMENT,
  name: 'Enhanced Embodiment',
  balance: {
    id: CONDUIT_BALANCE_PROFILE_IDS.enhancedEmbodiment,
    rechargeMultiplier: 0.6,
    effects: [
      {
        name: 'cosmic-wisdom-extension',
        type: 'buff',
        kind: 'cosmic-wisdom-extension',
        duration: 1,
        stacks: 1
      }
    ]
  }
});

/** Owns Expanded Consciousness tuning and behavior at its established execution boundaries. */
export const expandedConsciousness = defineTrait({
  id: TRAIT.EXPANDED_CONSCIOUSNESS,
  name: 'Expanded Consciousness',
  balance: { id: CONDUIT_BALANCE_PROFILE_IDS.expandedConsciousness, resourceGain: 15, effects: [] }
});

/** Owns Found Purpose tuning and behavior at its established execution boundaries. */
export const foundPurpose = defineTrait({ id: TRAIT.FOUND_PURPOSE, name: 'Found Purpose' });

/** Owns Kinetic Insight tuning and behavior at its established execution boundaries. */
export const kineticInsight = defineTrait({
  id: TRAIT.KINETIC_INSIGHT,
  name: 'Kinetic Insight',
  balance: { id: TRAIT.KINETIC_INSIGHT, rechargeMultiplier: 0.8, resourceGain: 2, effects: [] }
});

/** Owns Lingering Determination tuning and behavior at its established execution boundaries. */
export const lingeringDetermination = defineTrait({
  id: TRAIT.LINGERING_DETERMINATION,
  name: 'Lingering Determination',
  balance: { id: CONDUIT_BALANCE_PROFILE_IDS.lingeringDetermination, resourceGain: 2, effects: [] }
});

/** Owns Mistfire tuning and behavior at its established execution boundaries. */
export const mistfire = defineTrait({
  id: TRAIT.MISTFIRE,
  name: 'Mistfire',
  balance: {
    id: CONDUIT_BALANCE_PROFILE_IDS.mistfire,
    internalCooldown: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        name: 'Mistfire',
        actorType: 'effect'
      },
      {
        name: 'Burning',
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 6,
        actorType: 'effect'
      }
    ]
  },
  triggers: [
    {
      emit: PROFILE.mistfire,
      on: 'control.resolved',
      icd: 'profile',
      when: (runtime, event) =>
        !(event.skillId != null && TWIN_MOON_SKILL_IDS.has(event.skillId)) &&
        Boolean(requireEffect(requireBalanceProfileFromContext(runtime, PROFILE.mistfire), 'condition', 'Burning')),
      effects: (effect) => effect.type === 'condition' && effect.name === 'Burning',
      attribution: {
        source: 'revenant',
        ownerActorType: 'player',
        skillId: TRAIT.MISTFIRE,
        skillName: 'Mistfire',
        name: 'Mistfire — Burning'
      }
    }
  ]
});

/** Owns Numinous Gift tuning and behavior at its established execution boundaries. */
export const numinousGiftTrait = defineTrait({
  buildAttributes: (_common, { balanceContext, build, disabledTrait }) => ({
    traitDurations: getActiveTraits((build as RevenantBuild).specializations ?? []).some(
      (trait) => trait.id === TRAIT.YEARNING_EMPOWERMENT && trait.name !== disabledTrait
    )
      ? Object.fromEntries(
          ['Bleeding', 'Burning', 'Confusion', 'Poison', 'Torment'].map((condition) => [
            condition + ' Duration',
            100 *
              balanceProfileNumber(
                requireBalanceProfileFromContext(balanceContext, CONDUIT_BALANCE_PROFILE_IDS.numinousGift),
                'conditionDurationBonus'
              )
          ])
        )
      : {}
  }),
  id: TRAIT.NUMINOUS_GIFT,
  name: 'Numinous Gift',
  balance: {
    id: CONDUIT_BALANCE_PROFILE_IDS.numinousGift,
    conditionDurationBonus: 0.05,
    effects: [
      { type: 'boon', boon: 'might', duration: 10, stacks: 5 },
      {
        type: 'boon',
        boon: 'fury',
        duration: 10,
        stacks: 1,
        metadata: { legendId: LEGEND.ASSASSIN }
      },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 5,
        stacks: 1,
        metadata: { legendId: LEGEND.DEMON }
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 5,
        stacks: 1,
        metadata: { legendId: LEGEND.DWARF }
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 5,
        stacks: 1,
        metadata: { legendId: LEGEND.CENTAUR }
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 5,
        stacks: 1,
        metadata: { legendId: LEGEND.ENTITY }
      }
    ]
  },
  modifierRules: [
    {
      id: 'revenant.targeted-destruction-numinous-gift',
      order: 100,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: {
        vulnerabilityPerStack: 0.005,
        bonus: 0.05
      },
      // Numinous Gift unlocks Targeted Destruction's bonus; the factor is expressed as a multiplier delta on top of
      // the existing vulnerability bonus so both traits stack multiplicatively with the base formula.
      factor: (context, _target, parameters) => {
        const base = 1 + vulnerabilityStacks(context) * parameters.vulnerabilityPerStack;
        return (base + parameters.bonus) / base;
      },
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        hasTrait(context, TRAIT.TARGETED_DESTRUCTION) &&
        hasTrait(context, TRAIT.NUMINOUS_GIFT)
    },
    {
      id: 'revenant.yearning-empowerment-numinous-gift',
      order: 103,
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, 'revenant.conduit.numinous-gift'),
          'conditionDurationBonus'
        ),
      when: (context) =>
        isDamagingCondition(context.condition) &&
        hasTrait(context, TRAIT.YEARNING_EMPOWERMENT) &&
        hasTrait(context, TRAIT.NUMINOUS_GIFT) &&
        !professionStaticRulesApplied(context.config)
    }
  ]
});

/** Owns Shared Wisdom tuning and behavior at its established execution boundaries. */
export const sharedWisdom = defineTrait({
  id: TRAIT.SHARED_WISDOM,
  name: 'Shared Wisdom',
  balance: {
    id: CONDUIT_BALANCE_PROFILE_IDS.sharedWisdom,
    effects: [
      {
        name: 'entity-skill',
        type: 'boon',
        boon: 'swiftness',
        duration: 5,
        stacks: 1,
        metadata: { trigger: 'entity-skill' }
      },
      {
        name: 'beguiling-haze',
        type: 'boon',
        boon: 'fury',
        duration: 5,
        stacks: 1,
        metadata: { trigger: 'beguiling-haze' }
      },
      {
        name: 'hex-eater-vortex',
        type: 'boon',
        boon: 'resolution',
        duration: 3,
        stacks: 1,
        metadata: { trigger: 'hex-eater-vortex' }
      },
      {
        name: 'gladiators-defense',
        type: 'boon',
        boon: 'stability',
        duration: 3,
        stacks: 1,
        metadata: { trigger: 'gladiators-defense' }
      },
      {
        name: 'twin-moon-sweep',
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 5,
        applications: 2,
        atMs: 0,
        intervalMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: { trigger: 'twin-moon-sweep' }
      }
    ]
  }
});

export const traitDefinitions = [
  kineticInsight,
  lingeringDetermination,
  enhancedEmbodiment,
  expandedConsciousness,
  sharedWisdom,
  numinousGiftTrait,
  bolsteredBonds,
  mistfire,
  foundPurpose,
  conductiveArmaments
];

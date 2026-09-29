import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { boonActive, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { bandTogetherReady } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import {
  RENEGADE_PROFILE_IDS as PROFILE,
  RENEGADE_PROFILE_IDS
} from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { kallasFervorStacks } from '#gw2/professions/revenant/specializations/renegade/traits/behavior.js';

/** Owns All for One tuning and behavior at its established execution boundaries. */
export const allForOne = defineTrait({
  id: TRAIT.ALL_FOR_ONE,
  name: 'All for One',
  balance: {
    id: RENEGADE_PROFILE_IDS.allForOne,
    icon: 'https://render.guildwars2.com/file/9398D8F8E764A23596E17EDAA35B99961D62F061/1769993.png',
    categories: ['Trait'],
    skillFamily: 'Trait',
    resourceGain: 10,
    rechargeMultiplier: 0.5
  },
  rechargeRules: [
    {
      when: (runtime, skill) => bandTogetherReady(runtime, skill.id),
      multiplier: { profile: PROFILE.allForOne, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Ambush Commander tuning and behavior at its established execution boundaries. */
export const ambushCommander = defineTrait({
  id: TRAIT.AMBUSH_COMMANDER,
  name: 'Ambush Commander',
  profiles: [
    {
      id: RENEGADE_PROFILE_IDS.kallasFervor,
      name: "Kalla's Fervor",
      profileKind: 'mechanic',

      maximumStacks: 5,
      lifeSiphonDamagePerStack: 0.02,
      effects: [
        {
          name: 'kallas-fervor',
          type: 'buff',
          kind: 'kallas-fervor',
          duration: 8,
          stacks: 1,
          actorType: 'player'
        }
      ]
    }
  ]
});

/** Owns Ashen Demeanor tuning and behavior at its established execution boundaries. */
export const ashenDemeanorTrait = defineTrait({
  id: TRAIT.ASHEN_DEMEANOR,
  name: 'Ashen Demeanor',
  balance: {
    id: RENEGADE_PROFILE_IDS.ashenDemeanor,
    cooldown: 10,
    fervorStacks: 3,
    effects: [
      { type: 'boon', boon: 'might', duration: 6, stacks: 5, audience: { recipients: 'self' } },
      { type: 'boon', boon: 'resistance', duration: 6, stacks: 1, audience: { recipients: 'self' } }
    ]
  }
});

/** Owns Blood Fury tuning and behavior at its established execution boundaries. */
export const bloodFury = defineTrait({
  id: TRAIT.BLOOD_FURY,
  name: 'Blood Fury',
  balance: {
    id: RENEGADE_PROFILE_IDS.bloodFury,
    conditionDurationBonus: 0.25,
    icon: 'https://render.guildwars2.com/file/10FA58BEA8CF9AAB3F7841B154DC26E95A4FC705/1769989.png',
    categories: ['Trait'],
    skillFamily: 'Trait',
    cooldown: 3
  },
  modifierRules: [
    {
      id: 'revenant.blood-fury-bleeding-duration',
      order: 104,
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, RENEGADE_PROFILE_IDS.bloodFury),
          'conditionDurationBonus'
        ),
      // Blood Fury shares the chronological player-Fury query used by Core Revenant modifiers.
      when: (context) => context.condition === 'Bleeding' && boonActive(context, 'fury')
    }
  ]
});

/** Owns the additional protection payload layered on the enhanced order. */
export const boldReversal = defineTrait({
  id: TRAIT.BOLD_REVERSAL,
  name: 'Bold Reversal',
  profiles: [
    {
      id: RENEGADE_PROFILE_IDS.boldReversalRighteousRebel,
      name: 'Orders from Above (Bold Reversal + Righteous Rebel)',
      profileKind: 'skill-variant',

      effects: [
        {
          type: 'boon',
          boon: 'protection',
          duration: 1,
          stacks: 1,
          applications: 6,
          intervalMs: 1000,
          timingAnchor: 'castEnd',
          timingScale: 'fixed',
          actorType: 'player'
        }
      ]
    }
  ]
});

/** Owns Brutal Momentum tuning and behavior at its established execution boundaries. */
export const brutalMomentum = defineTrait({
  buildAttributes: (_common, { balanceContext }) => ({
    traitCriticalChance:
      100 *
      balanceProfileNumber(
        requireBalanceProfileFromContext(balanceContext, RENEGADE_PROFILE_IDS.brutalMomentum),
        'criticalChance'
      )
  }),
  id: TRAIT.BRUTAL_MOMENTUM,
  name: 'Brutal Momentum',
  balance: {
    id: RENEGADE_PROFILE_IDS.brutalMomentum,
    criticalChance: 0.1,
    fullEnduranceCriticalChance: 0.33,
    internalCooldown: 8,
    effects: [{ name: 'vigor', type: 'boon', boon: 'vigor', duration: 6, stacks: 1 }]
  },
  triggers: [
    {
      emit: PROFILE.brutalMomentum,
      on: 'buff.applied',
      icd: 'profile',
      when: (runtime, event) =>
        (event.kind || '').toLowerCase() === 'fury' &&
        gw2BoonApplicationRecipients(runtime.config, event).includesSelf &&
        Boolean(requireEffect(requireBalanceProfileFromContext(runtime, PROFILE.brutalMomentum), 'boon', 'vigor')),
      effects: (effect) => effect.type === 'boon' && effect.name === 'vigor',
      attribution: {
        source: 'revenant',
        actorType: 'player',
        skillId: PROFILE.brutalMomentum,
        skillName: 'Brutal Momentum',
        name: undefined
      }
    }
  ]
});

/** Owns Endless Enmity tuning and behavior at its established execution boundaries. */
export const endlessEnmity = defineTrait({
  id: TRAIT.ENDLESS_ENMITY,
  name: 'Endless Enmity',
  balance: {
    id: RENEGADE_PROFILE_IDS.endlessEnmity,
    icon: 'https://render.guildwars2.com/file/A4D16BE749A19FE8A8B5783EE2BD1DF899156D47/1769999.png',
    categories: ['Trait'],
    skillFamily: 'Trait',
    internalCooldown: 8,
    effects: [
      {
        name: 'fury',
        type: 'boon',
        boon: 'fury',
        duration: 4,
        stacks: 1,
        audience: { recipients: 'party' as const },
        actorType: 'player'
      }
    ]
  },
  triggers: [
    {
      emit: PROFILE.endlessEnmity,
      on: 'damage.resolved',
      icd: 'profile',
      when: (runtime, event, details) =>
        event.actorType === 'player' &&
        Number(event.coefficient) > 0 &&
        Boolean(details.hitContext?.critEligible && details.hitContext.critical.didCrit) &&
        Boolean(requireEffect(requireBalanceProfileFromContext(runtime, PROFILE.endlessEnmity), 'boon', 'fury')),
      effects: (effect) => effect.type === 'boon' && effect.name === 'fury',
      attribution: {
        source: 'revenant',
        actorType: 'player',
        skillId: TRAIT.ENDLESS_ENMITY,
        skillName: 'Endless Enmity',
        name: 'Endless Enmity \u2014 fury'
      }
    }
  ]
});

/** Owns Heartpiercer tuning and behavior at its established execution boundaries. */
export const heartpiercer = defineTrait({
  id: TRAIT.HEARTPIERCER,
  name: 'Heartpiercer',
  modifierRules: [
    {
      id: 'revenant.heartpiercer-strike',
      order: 100,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.15,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetConditionActive(context, 'Bleeding')
    },
    {
      id: 'revenant.heartpiercer-bleeding',
      order: 101,
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: 1.25,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && context.condition === 'Bleeding'
    }
  ]
});

/** Owns Lasting Legacy tuning and behavior at its established execution boundaries. */
export const lastingLegacy = defineTrait({
  id: TRAIT.LASTING_LEGACY,
  name: 'Lasting Legacy',
  profiles: [
    {
      id: RENEGADE_PROFILE_IDS.kallasFervorLastingLegacy,
      name: "Kalla's Fervor (Lasting Legacy)",
      profileKind: 'trait',

      variantBadge: 'Lasting Legacy',
      maximumStacks: 5,
      lifeSiphonDamagePerStack: 0.03,
      effects: [
        {
          name: 'kallas-fervor',
          type: 'buff',
          kind: 'kallas-fervor',
          duration: 12,
          stacks: 1,
          actorType: 'player'
        }
      ]
    },
    {
      id: RENEGADE_PROFILE_IDS.heroicCommandLastingLegacy,
      name: 'Heroic Command (Lasting Legacy)',
      profileKind: 'skill-variant',

      variantBadge: 'Lasting Legacy',
      effects: [
        {
          name: 'might',
          type: 'boon',
          boon: 'might',
          duration: 8,
          stacks: 3,
          actorType: 'player'
        }
      ]
    }
  ],
  modifierRules: [
    {
      requiresSelection: false,
      id: 'revenant.kallas-fervor-strike',
      order: 102,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      parameters: {
        damagePerStack: 0.02,
        improvedDamagePerStack: 0.05
      },
      amount: (context, _target, parameters) => {
        const perStack = hasTrait(context, TRAIT.LASTING_LEGACY)
          ? parameters.improvedDamagePerStack
          : parameters.damagePerStack;
        return kallasFervorStacks(context) * perStack;
      },
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && kallasFervorStacks(context) > 0
    },
    {
      requiresSelection: false,
      id: 'revenant.kallas-fervor-condition',
      order: 103,
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      parameters: {
        damagePerStack: 0.02,
        improvedDamagePerStack: 0.03
      },
      amount: (context, _target, parameters) => {
        const perStack = hasTrait(context, TRAIT.LASTING_LEGACY)
          ? parameters.improvedDamagePerStack
          : parameters.damagePerStack;
        return kallasFervorStacks(context) * perStack;
      },
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && kallasFervorStacks(context) > 0
    }
  ]
});

/** Owns Righteous Rebel tuning and behavior at its established execution boundaries. */
export const righteousRebel = defineTrait({
  id: TRAIT.RIGHTEOUS_REBEL,
  name: 'Righteous Rebel',
  profiles: [
    {
      id: RENEGADE_PROFILE_IDS.ordersFromAboveRighteousRebel,
      name: 'Orders from Above (Righteous Rebel)',
      profileKind: 'skill-variant',

      variantBadge: 'Righteous Rebel',
      effects: [
        {
          type: 'boon',
          boon: 'alacrity',
          duration: 2,
          stacks: 1,
          applications: 6,
          intervalMs: 1000,
          timingAnchor: 'castEnd',
          timingScale: 'fixed',
          actorType: 'player'
        }
      ]
    }
  ]
});

/** Owns Vindication tuning and behavior at its established execution boundaries. */
export const vindication = defineTrait({
  id: TRAIT.VINDICATION,
  name: 'Vindication',
  balance: {
    id: RENEGADE_PROFILE_IDS.vindication,
    icon: 'https://render.guildwars2.com/file/3453B30240026E36661AACD3FA94FB0DBFC8246C/1769995.png',
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        name: 'daze',
        type: 'control',
        actorType: 'player',
        controlKind: 'daze'
      }
    ]
  },
  triggers: [
    {
      on: 'damage.resolved',
      when: (_runtime, event) => event.skillId === ID.CITADEL_BOMBARDMENT && Number(event.hitIndex || 1) === 1,
      emit: PROFILE.vindication,
      effects: (effect) => effect.type === 'control' && effect.name === 'daze',
      attribution: {
        source: 'revenant',
        sourceId: TRAIT.VINDICATION,
        actorType: 'player',
        skillId: TRAIT.VINDICATION,
        skillName: 'Vindication',
        name: 'Vindication — Daze'
      }
    }
  ]
});

export const traitDefinitions = [
  boldReversal,
  brutalMomentum,
  ambushCommander,
  lastingLegacy,
  righteousRebel,
  ashenDemeanorTrait,
  endlessEnmity,
  bloodFury,
  allForOne,
  vindication,
  heartpiercer
];

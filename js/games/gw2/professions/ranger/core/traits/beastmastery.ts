import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { compileProfessionRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  activeBuff,
  beastmodeActive,
  rangerBoonActive,
  rangerPetEvent
} from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerBuild, RangerRuntimeState } from '#gw2/professions/ranger/types.js';

/** Owns Resounding Timbre's live tuning and trait behavior. */
export const resoundingTimbre = defineTrait({
  id: TRAIT.RESOUNDING_TIMBRE,
  name: 'Resounding Timbre',
  balance: {
    durationMultiplier: 2
  }
});

/** Owns Go for the Throat's live tuning and trait behavior. */
export const goForTheThroat = defineTrait({
  id: TRAIT.GO_FOR_THE_THROAT,
  name: 'Go for the Throat',
  balance: {
    internalCooldown: 10,
    effects: [
      {
        name: 'lesser-sic-em-pet',
        type: 'buff',
        kind: 'lesser-sic-em-pet',
        duration: 8,
        stacks: 1
      },
      { name: 'lesser-sic-em', type: 'buff', kind: 'lesser-sic-em', duration: 5, stacks: 1 }
    ]
  },
  modifierRules: [
    {
      order: 31,
      requiresSelection: false,
      id: 'ranger.lesser-sic-em-pet',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.4,
      when: (context) => rangerPetEvent(context) && rangerBoonActive(context, 'lesser-sic-em-pet')
    }
  ]
});

/** Owns Honed Axes's live tuning and trait behavior. */
export const honedAxes = defineTrait({
  id: TRAIT.HONED_AXES,
  name: 'Honed Axes',
  balance: {
    weaponAttributeBonus: 240,
    attributeBonus: 120,
    rechargeMultiplier: 0.8
  },
  rechargeRules: [
    {
      order: 1,
      when: (_runtime, skill) => skill.weapon === 'Axe',
      multiplier: { profile: TRAIT.HONED_AXES, field: 'rechargeMultiplier' }
    }
  ],
  buildAttributes: (_common, { balanceContext: profileContext, build, weaponSet }) => {
    const profile = requireBalanceProfileFromContext(profileContext, TRAIT.HONED_AXES);
    const weapons = (weaponSet === 2 ? build.alternateWeapons : build.weapons) || [];
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: balanceProfileNumber(profile, weapons.includes('Axe') ? 'weaponAttributeBonus' : 'attributeBonus'),
          feedsConversions: false
        }
      ]
    };
  }
});

/** Owns Pack Alpha's live tuning and trait behavior. */
export const packAlpha = defineTrait({
  id: TRAIT.PACK_ALPHA,
  name: 'Pack Alpha',
  balance: {
    attributeBonus: 150,
    weaponAttributeBonus: 300,
    rechargeMultiplier: 0.8
  },
  rechargeRules: [
    {
      order: 5,
      when: (_runtime, skill) => Boolean(skill.petSkill),
      multiplier: { profile: TRAIT.PACK_ALPHA, field: 'rechargeMultiplier' }
    }
  ],
  buildAttributes: (_common, { balanceContext, build }) => ({
    attributeEffects: ['Power', 'Condition Damage', 'Precision', 'Toughness', 'Vitality'].map((to) => ({
      kind: 'flat' as const,
      to,
      amount: balanceProfileNumber(
        requireBalanceProfileFromContext(balanceContext, TRAIT.PACK_ALPHA),
        'attributeBonus'
      ),
      feedsConversions: false,
      enabled: (build as RangerBuild).specializations?.some((s) => s.name === 'Soulbeast')
    }))
  })
});

/** Owns Pet's Prowess's live tuning and trait behavior. */
export const petsProwess = defineTrait({
  id: TRAIT.PETS_PROWESS,
  name: "Pet's Prowess",
  balance: {
    attributeBonus: 300
  },
  buildAttributes: (_common, { balanceContext: profileContext, build }) => {
    const profile = requireBalanceProfileFromContext(profileContext, TRAIT.PETS_PROWESS);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: balanceProfileNumber(profile, 'attributeBonus'),
          feedsConversions: false,
          enabled: (build as RangerBuild).specializations?.some((s) => s.name === 'Soulbeast')
        }
      ]
    };
  }
});

/** Owns Wilting Strike's live tuning and trait behavior. */
export const wiltingStrike = defineTrait({
  id: TRAIT.WILTING_STRIKE,
  name: 'Wilting Strike',
  balance: {
    effects: [{ name: 'Weakness', type: 'condition', condition: 'Weakness', duration: 4, stacks: 1 }]
  }
});

/** Owns Go for the Eyes's live tuning and trait behavior. */
export const goForTheEyes = defineTrait({
  id: TRAIT.GO_FOR_THE_EYES,
  name: 'Go for the Eyes',
  balance: {
    internalCooldown: 12,
    effects: [{ name: 'Blind', type: 'blind', duration: 5 }]
  }
});

/** Owns Bestial Rage's live tuning and trait behavior. */
export const bestialRage = defineTrait({
  id: TRAIT.BESTIAL_RAGE,
  name: 'Bestial Rage',
  balance: {
    internalCooldown: 0.25,
    effects: [
      { name: 'might', type: 'boon', boon: 'might', duration: 8, stacks: 5 },
      { name: 'fury', type: 'boon', boon: 'fury', duration: 3, stacks: 1 }
    ]
  }
});

/** Owns Loud Whistle's live tuning and trait behavior. */
export const loudWhistle = defineTrait({
  id: TRAIT.LOUD_WHISTLE,
  name: 'Loud Whistle',
  modifierRules: [
    {
      order: 34,
      id: 'ranger.loud-whistle-pet',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.15,
      when: (context) => rangerPetEvent(context)
    }
  ]
});

/** Core trait executes at Soulbeast's established control-reaction boundary. */
export const bestialRageControl = compileProfessionRules<RangerRuntimeState>({
  traitTriggers: [
    {
      trait: TRAIT.BESTIAL_RAGE,
      emit: TRAIT.BESTIAL_RAGE,
      on: 'control.resolved',
      icd: 'profile',
      // Only the surviving boon effects can activate this trait's control proc.
      when: (runtime) =>
        ['might', 'fury'].some((effectName) =>
          Boolean(requireEffect(requireBalanceProfileFromContext(runtime, TRAIT.BESTIAL_RAGE), 'boon', effectName))
        ),
      effects: (effect) =>
        (effect.type === 'boon' || effect.type === 'buff') && (effect.name === 'might' || effect.name === 'fury'),
      attribution: (_runtime, event) => ({
        skillId: TRAIT.BESTIAL_RAGE,
        skillName: 'Bestial Rage',
        name: 'Bestial Rage',
        triggeredBy: event.skillName,
        ...(event.metadata?.triggeredByAlly
          ? {
              audience: {
                recipients: 'party' as const,
                alliedPlayerIndex: event.metadata.triggeredByAlly,
                affectsSelf: false,
                maximumRecipients: 1,
                eligibleCompanionIds: []
              },
              metadata: { triggeredByAlly: event.metadata.triggeredByAlly }
            }
          : {})
      })
    }
  ]
}).reactions!['control.resolved']!;

/** Installs the Core trait at Soulbeast's existing modifier boundary. */
export const loudWhistleMergedModifier: Gw2ModifierRule = {
  order: 100,
  id: 'ranger.loud-whistle-player',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  factor: 1.1,
  when: (context) =>
    isGw2PlayerModifierOwnedEvent(context.event) && beastmodeActive(context) && hasTrait(context, TRAIT.LOUD_WHISTLE)
};

/** Installs the Core trait at Soulbeast's existing modifier boundary. */
export const goForTheThroatMergedModifier: Gw2ModifierRule = {
  order: 103,
  id: 'ranger.lesser-sic-em-player',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  factor: 1.15,
  when: (context) => activeBuff(context, 'lesser-sic-em')
};

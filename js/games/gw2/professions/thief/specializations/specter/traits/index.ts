import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import {
  applyDarkSentry,
  applyLarcenousTorment
} from '#gw2/professions/thief/specializations/specter/traits/behavior.js';

/** Owns Amplified Siphoning tuning and behavior at the existing execution boundaries. */
export const amplifiedSiphoning = defineTrait({
  id: TRAIT.AMPLIFIED_SIPHONING,
  name: 'Amplified Siphoning',
  balance: { resourceGain: 10 }
});

/** Owns Dark Sentry tuning and behavior at the existing execution boundaries. */
export const darkSentry = defineTrait({
  id: TRAIT.DARK_SENTRY,
  name: 'Dark Sentry',
  balance: {
    internalCooldown: 1,
    effects: [
      {
        type: 'buff',
        name: 'rot-wallow-venom',
        kind: 'rot-wallow-venom',
        stacks: 1,
        duration: 10
      },
      { type: 'condition', name: 'Torment', condition: 'Torment', stacks: 1, duration: 2 }
    ]
  },
  hooks: { tasks: { 'thief.specter-dark-sentry': applyDarkSentry } }
});

/** Owns Larcenous Torment tuning and behavior at the existing execution boundaries. */
export const larcenousTorment = defineTrait({
  id: TRAIT.LARCENOUS_TORMENT,
  name: 'Larcenous Torment',
  balance: {
    resourceGain: 0.5,
    effects: [{ type: 'strike', name: 'Larcenous Torment', flatStrikeBase: 99, flatStrikePowerCoeff: 0.005, hits: 1 }]
  },
  hooks: { reactions: { 'condition.applied': applyLarcenousTorment } }
});

/** Owns Second Opinion tuning and behavior at the existing execution boundaries. */
export const secondOpinion = defineTrait({
  id: TRAIT.SECOND_OPINION,
  name: 'Second Opinion',
  balance: {
    attributeBonus: 90,
    attributePerStack: 90,
    attributeConversion: 0.07
  },
  buildAttributes(_common, { build, weaponSet, balanceContext }) {
    const weapons = (weaponSet === 2 ? build.alternateWeapons : build.weapons) || [];
    const secondOpinionProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.SECOND_OPINION);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Condition Damage',
          amount:
            balanceProfileNumber(secondOpinionProfile, 'attributeBonus') +
            (weapons.includes('Scepter') ? balanceProfileNumber(secondOpinionProfile, 'attributePerStack') : 0),
          feedsConversions: true
        },
        {
          kind: 'conversion',
          from: 'Condition Damage',
          to: 'Healing Power',
          multiplier: balanceProfileNumber(secondOpinionProfile, 'attributeConversion'),
          rounding: 'round',
          input: 'eligible'
        }
      ]
    };
  }
});

/** Owns Shadestep tuning and behavior at the existing execution boundaries. */
export const shadestep = defineTrait({
  id: TRAIT.SHADESTEP,
  name: 'Shadestep',
  balance: {
    effects: [
      { type: 'boon', name: 'alacrity', boon: 'alacrity', stacks: 1, duration: 5 },
      { type: 'boon', name: 'protection', boon: 'protection', stacks: 1, duration: 5 },
      { type: 'boon', name: 'aegis', boon: 'aegis', stacks: 1, duration: 4 }
    ]
  },
  hooks: {
    sideEffectHandlers: {
      'thief.dawn-shade-step'(runtime, context) {
        if (context.kind !== 'cast' || !hasTrait(runtime, TRAIT.SHADESTEP)) return;
        const profile = requireBalanceProfileFromContext(runtime, TRAIT.SHADESTEP);
        emitEffects(runtime, {
          owner: profile,
          effects: profile.effects?.filter((effect) => effect.type === 'boon' && effect.name === 'protection'),
          baseEvent: {
            source: 'Trait',
            sourceId: TRAIT.SHADESTEP,
            actorType: 'player',
            skillId: context.skill.id,
            skillName: context.skill.name,
            activationId: context.cast.id
          },
          transform: (event) => ({ ...event, name: 'Shade Step - protection', audience: { recipients: 'party' } })
        });
      }
    }
  },
  triggers: [
    {
      emit: TRAIT.SHADESTEP,
      on: 'castCommit',
      when: (_runtime, cast) =>
        cast.skill.id === ID.GRASPING_SHADOWS && Boolean(cast.skill.shadowShroudSkill) && !castWasInterrupted(cast),
      effects: (effect) => effect.type === 'boon' && effect.name === 'alacrity',
      attribution: { actorType: 'player', name: 'Shade Step - alacrity', audience: { recipients: 'party' } }
    },
    {
      emit: TRAIT.SHADESTEP,
      on: 'castCommit',
      when: (_runtime, cast) =>
        cast.skill.id === ID.MIND_SHOCK && Boolean(cast.skill.shadowShroudSkill) && !castWasInterrupted(cast),
      effects: (effect) => effect.type === 'boon' && effect.name === 'aegis',
      attribution: { actorType: 'player', name: 'Shade Step - aegis', audience: { recipients: 'party' } }
    }
  ]
});

/** Owns Strength of Shadows tuning and behavior at the existing execution boundaries. */
export const strengthOfShadows = defineTrait({
  id: TRAIT.STRENGTH_OF_SHADOWS,
  name: 'Strength of Shadows',
  modifierRules: [
    {
      order: 300,
      id: 'thief.strength-of-shadows',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: 0.2,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && context.event?.condition === 'Torment'
    }
  ],
  balance: {
    attributeConversion: 0.13
  },
  buildAttributes(_common, { balanceContext }) {
    const strengthOfShadowsProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.STRENGTH_OF_SHADOWS);
    return {
      attributeEffects: [
        {
          kind: 'conversion',
          from: 'Vitality',
          to: 'Expertise',
          multiplier: balanceProfileNumber(strengthOfShadowsProfile, 'attributeConversion'),
          rounding: 'round',
          input: 'eligible'
        }
      ]
    };
  }
});

/** Native trait owners, in stable authoring order. */
export const specterTraits = Object.freeze([
  amplifiedSiphoning,
  shadestep,
  larcenousTorment,
  darkSentry,
  secondOpinion,
  strengthOfShadows
]);

import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { isPetStrike, isPlayerStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

/** Owns Child of Earth's live tuning and trait behavior. */
export const childOfEarth = defineTrait({
  id: TRAIT.CHILD_OF_EARTH,
  name: 'Child of Earth',
  balance: {
    internalCooldown: 20,
    pulseInterval: 2,
    maximumStacks: 5,
    effects: [
      {
        name: 'Immobilized',
        type: 'condition',
        condition: 'Immobilized',
        duration: 1,
        stacks: 1
      },
      { name: 'Crippled', type: 'condition', condition: 'Crippled', duration: 2, stacks: 1 },
      { name: 'Slow', type: 'condition', condition: 'Slow', duration: 1, stacks: 1 }
    ]
  }
});

/** Owns Poison Master's live tuning and trait behavior. */
export const poisonMaster = defineTrait({
  id: TRAIT.POISON_MASTER,
  name: 'Poison Master',
  balance: {
    effects: [{ name: 'Poisoned', type: 'condition', condition: 'Poisoned', duration: 8, stacks: 2 }]
  },
  modifierRules: [
    {
      order: 13,
      id: 'ranger.poison-master',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: 1.25,
      // The damage bonus is Ranger-owned; the separately triggered pet attack also resolves from Ranger stats.
      when: (context) => context.condition === 'Poisoned' && isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Owns Arachnophobia's live tuning and trait behavior. */
export const arachnophobia = defineTrait({
  id: TRAIT.ARACHNOPHOBIA,
  name: 'Arachnophobia',
  balance: {
    // Torment belongs to the triggering spider/devourer pet; pet damage is excluded from this preview.
    damagePreviewAttribution: 'summon',
    attributeBonus: 150,
    weaponAttributeBonus: 225,
    effects: [{ name: 'Torment', type: 'condition', condition: 'Torment', duration: 3, stacks: 1 }]
  },
  buildAttributes: traitAttributeEffects(TRAIT.ARACHNOPHOBIA, [
    { kind: 'flat', to: 'Expertise', field: 'attributeBonus', feedsConversions: false }
  ])
});

/** Owns Carnivore's live tuning and trait behavior. */
export const carnivore = defineTrait({
  id: TRAIT.CARNIVORE,
  name: 'Carnivore',
  balance: {
    internalCooldown: 0.25,
    // Resolve and display the siphon separately, using base damage plus Power without weapon or armor scaling.
    effects: [
      {
        name: 'Strike',
        type: 'strike',
        coefficient: 0,
        flatStrikeBase: 3255,
        flatStrikePowerCoeff: 0.05,
        damageBreakdownName: 'Life Siphon - Carnivore',
        hits: 1,
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
  },
  triggers: [
    {
      order: 0,
      emit: TRAIT.CARNIVORE,
      on: 'control.resolved',
      icd: 'profile',
      when: (runtime, event) =>
        (isPlayerStrike(event) || isPetStrike(event)) &&
        Boolean(requireEffect(requireBalanceProfileFromContext(runtime, TRAIT.CARNIVORE), 'strike', 'Strike')),
      effects: (effect) => effect.type === 'strike' && effect.name === 'Strike',
      attribution: (_runtime, event) => ({
        skillId: TRAIT.CARNIVORE,
        skillName: 'Carnivore',
        name: 'Carnivore',
        skillWeapon: 'Unequipped',
        triggeredBy: event.skillName
      })
    }
  ]
});

/** Owns Natural Vigor's live tuning and trait behavior. */
export const naturalVigor = defineTrait({
  id: TRAIT.NATURAL_VIGOR,
  name: 'Natural Vigor',
  balance: {
    vigorRegenerationMultiplier: 0.25
  }
});

/** Owns Ambidexterity's live tuning and trait behavior. */
export const ambidexterity = defineTrait({
  id: TRAIT.AMBIDEXTERITY,
  name: 'Ambidexterity',
  balance: {
    weaponAttributeBonus: 240,
    attributeBonus: 120,
    rechargeMultiplier: 0.8
  },
  rechargeRules: [
    {
      order: 4,
      when: (_runtime, skill) => ['Dagger', 'Torch'].includes(String(skill.weapon)),
      multiplier: { profile: TRAIT.AMBIDEXTERITY, field: 'rechargeMultiplier' }
    }
  ],
  buildAttributes: (_common, { balanceContext: profileContext, build, weaponSet }) => {
    const profile = requireBalanceProfileFromContext(profileContext, TRAIT.AMBIDEXTERITY);
    const weapons = (weaponSet === 2 ? build.alternateWeapons : build.weapons) || [];
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Condition Damage',
          amount: balanceProfileNumber(
            profile,
            weapons.some((weapon) => ['Dagger', 'Mace', 'Torch'].includes(weapon))
              ? 'weaponAttributeBonus'
              : 'attributeBonus'
          ),
          feedsConversions: false
        }
      ]
    };
  }
});

/** Owns Survival Instincts's live tuning and trait behavior. */
export const survivalInstincts = defineTrait({
  id: TRAIT.SURVIVAL_INSTINCTS,
  name: 'Survival Instincts',
  modifierRules: [
    {
      order: 14,
      id: 'ranger.survival-instincts',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.15,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

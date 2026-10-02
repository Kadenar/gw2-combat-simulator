import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import {
  heraldOfSorrowAvailability,
  sandSavantMaximumAmmo
} from '#gw2/professions/necromancer/specializations/scourge/traits/behavior.js';

/** Owns Demonic Lore tuning and behavior at its existing execution boundaries. */
export const demonicLore = defineTrait({
  id: TRAIT.DEMONIC_LORE,
  name: 'Demonic Lore',
  balance: {
    cooldown: 3,
    effects: [
      {
        name: 'Burning',
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 1,
        actorType: 'effect'
      }
    ]
  },
  modifierRules: [
    {
      order: 121,
      id: 'necromancer.demonic-lore',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: 1.33,
      when: (context) => context.condition === 'Torment'
    }
  ]
});

/** Owns Sand Savant tuning and behavior at its existing execution boundaries. */
export const sandSavant = defineTrait({
  id: TRAIT.SAND_SAVANT,
  name: 'Sand Savant',
  balance: {
    maximumStacks: 1,
    rechargePenalty: 1.25,
    effects: [
      {
        name: 'active-shade',
        type: 'buff',
        kind: 'active-shade',
        stacks: 1,
        duration: 8,
        actorType: 'player'
      }
    ]
  },
  rechargeRules: [
    {
      order: 1,

      when: (_runtime, skill) => skill.id === ID.MANIFEST_SAND_SHADE,
      multiplier: { profile: TRAIT.SAND_SAVANT, field: 'rechargePenalty' }
    }
  ],
  hooks: { maximumAmmo: (runtime, skill, maximum) => sandSavantMaximumAmmo(runtime, skill, maximum) }
});

/** Owns Abrasive Grit tuning and behavior at its existing execution boundaries. */
export const abrasiveGrit = defineTrait({
  id: TRAIT.ABRASIVE_GRIT,
  name: 'Abrasive Grit',
  balance: {
    effects: [
      {
        name: 'might',
        type: 'boon',
        boon: 'might',
        stacks: 2,
        duration: 6,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      }
    ]
  }
});

/** Owns Desert Empowerment tuning and behavior at its existing execution boundaries. */
export const desertEmpowerment = defineTrait({
  id: TRAIT.DESERT_EMPOWERMENT,
  name: 'Desert Empowerment',
  balance: {
    effects: [
      {
        name: 'alacrity',
        type: 'boon',
        boon: 'alacrity',
        stacks: 1,
        duration: 1.5,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      }
    ]
  }
});

/** Owns Sadistic Searing tuning and behavior at its existing execution boundaries. */
export const sadisticSearing = defineTrait({
  id: TRAIT.SADISTIC_SEARING,
  name: 'Sadistic Searing',
  balance: {
    effects: [
      {
        name: 'Burning',
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Fell Beacon tuning and behavior at its existing execution boundaries. */
export const fellBeacon = defineTrait({
  id: TRAIT.FELL_BEACON,
  name: 'Fell Beacon',
  balance: {
    attributeConversion: 0.07
  },
  modifierRules: [
    {
      order: 120,
      id: 'necromancer.fell-beacon',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      when: (context) => context.condition === 'Burning'
    }
  ],
  buildAttributes: traitAttributeEffects(TRAIT.FELL_BEACON, [
    {
      kind: 'conversion',
      from: 'Condition Damage',
      to: 'Expertise',
      field: 'attributeConversion',
      rounding: 'none',
      input: 'eligible'
    }
  ])
});

/** Owns Sand Sage tuning and behavior at its existing execution boundaries. */
export const sandSage = defineTrait({
  id: TRAIT.SAND_SAGE,
  name: 'Sand Sage',
  balance: {
    attributeBonus: 225
  }
});

/** Owns Nourishing Ashes tuning and behavior at its existing execution boundaries. */
export const nourishingAshes = defineTrait({
  id: TRAIT.NOURISHING_ASHES,
  name: 'Nourishing Ashes',
  balance: {
    lifeForceGain: 5,
    cooldown: 3
  }
});

/** Owns Herald of Sorrow's ordered mechanic integration. */
export const heraldOfSorrow = defineTrait({
  id: TRAIT.HERALD_OF_SORROW,
  name: 'Herald of Sorrow',
  hooks: { availability: (runtime, skill, command) => heraldOfSorrowAvailability(runtime, skill, command) }
});

/** Registers each native trait owner once in its existing execution order. */
export const necromancerScourgeTraits = [
  demonicLore,
  sandSavant,
  abrasiveGrit,
  desertEmpowerment,
  sadisticSearing,
  fellBeacon,
  sandSage,
  nourishingAshes,
  heraldOfSorrow
];

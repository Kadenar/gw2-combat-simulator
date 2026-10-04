import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { necromancerActiveShroud } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

/** Owns Dhuumfire tuning and behavior at its existing execution boundaries. */
export const dhuumfire = defineTrait({
  id: TRAIT.DHUUMFIRE,
  name: 'Dhuumfire',
  balance: {
    effects: [
      {
        name: 'Burning',
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 3,
        actorType: 'effect'
      }
    ]
  }
});

/** Owns Unyielding Blast tuning and behavior at its existing execution boundaries. */
export const unyieldingBlast = defineTrait({
  id: TRAIT.UNYIELDING_BLAST,
  name: 'Unyielding Blast',
  balance: {
    effects: [
      {
        name: 'Vulnerability',
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 10,
        actorType: 'effect'
      }
    ]
  }
});

/** Owns Vital Persistence tuning and behavior at its existing execution boundaries. */
export const vitalPersistence = defineTrait({
  id: TRAIT.VITAL_PERSISTENCE,
  name: 'Vital Persistence',
  balance: { attributeBonus: 180 },
  buildAttributes: traitAttributeEffects(TRAIT.VITAL_PERSISTENCE, [
    { kind: 'flat', to: 'Vitality', field: 'attributeBonus', feedsConversions: true }
  ])
});

/** Owns Sinister Shroud tuning and behavior at its existing execution boundaries. */
export const sinisterShroud = defineTrait({
  id: TRAIT.SINISTER_SHROUD,
  name: 'Sinister Shroud',
  balance: { rechargeMultiplier: 0.85 },
  rechargeRules: [
    {
      order: 1,

      when: (_runtime, skill) => Boolean(skill.shroud),
      multiplier: { profile: TRAIT.SINISTER_SHROUD, field: 'rechargeMultiplier' }
    },
    {
      order: 0,

      when: (_runtime, skill) => SHADE_SKILLS.has(Number(skill.id)),
      multiplier: { profile: TRAIT.SINISTER_SHROUD, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Death Perception tuning and behavior at its existing execution boundaries. */
export const deathPerception = defineTrait({
  id: TRAIT.DEATH_PERCEPTION,
  name: 'Death Perception',
  balance: {
    criticalDamage: 1.1,
    criticalChance: 0.15
  },
  modifierRules: [
    {
      order: -18,
      id: 'necromancer.death-perception-critical-chance',
      label: 'Death Perception',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DEATH_PERCEPTION), 'criticalChance')
    },
    {
      order: 105,
      id: 'necromancer.death-perception-critical-hit-damage',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DEATH_PERCEPTION), 'criticalDamage'),
      when: (context) => Boolean(necromancerActiveShroud(context))
    }
  ],
  buildAttributes: (_common, { balanceContext: profileContext }) => ({
    traitCriticalChance:
      balanceProfileNumber(requireBalanceProfileFromContext(profileContext, TRAIT.DEATH_PERCEPTION), 'criticalChance') *
      100
  })
});

/** Owns Soul Barbs tuning and behavior at its existing execution boundaries. */
export const soulBarbs = defineTrait({
  id: TRAIT.SOUL_BARBS,
  name: 'Soul Barbs',
  balance: { duration: 15 },
  modifierRules: [
    {
      order: -17,
      id: 'necromancer.soul-barbs',
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) => Boolean(context.timeline?.timedActive('necromancer-soul-barbs', context.time))
    }
  ]
});

/** Owns Eternal Life tuning and behavior at its existing execution boundaries. */
export const eternalLife = defineTrait({
  id: TRAIT.ETERNAL_LIFE,
  name: 'Eternal Life',
  balance: {
    lifeForceGain: 3,
    threshold: 0.66,
    pulseInterval: 1,
    effects: [
      { name: 'protection', type: 'boon', boon: 'protection', stacks: 1, duration: 3, packetLabel: 'on shroud entry' }
    ]
  }
});

/** Owns Fear of Death tuning and behavior at its existing execution boundaries. */
export const fearOfDeath = defineTrait({
  id: TRAIT.FEAR_OF_DEATH,
  name: 'Fear of Death',
  balance: { lifeForceGain: 15, internalCooldown: 4 }
});

/** Owns Speed of Shadows tuning and behavior at its existing execution boundaries. */
export const speedOfShadows = defineTrait({
  id: TRAIT.SPEED_OF_SHADOWS,
  name: 'Speed of Shadows',
  balance: {
    effects: [
      { name: 'swiftness', type: 'boon', boon: 'swiftness', stacks: 1, duration: 10, packetLabel: 'on shroud entry' }
    ]
  }
});

/** Owns Soul Marks tuning and behavior at its existing execution boundaries. */
export const soulMarks = defineTrait({ id: TRAIT.SOUL_MARKS, name: 'Soul Marks', balance: { lifeForceGain: 3 } });

/** Owns Soul Battery tuning and behavior at its existing execution boundaries. */
export const soulBattery = defineTrait({
  id: TRAIT.SOUL_BATTERY,
  name: 'Soul Battery',
  balance: { lifeForceCapacityMultiplier: 1.2 }
});

/** Owns Gluttony tuning and behavior at its existing execution boundaries. */
export const gluttony = defineTrait({
  id: TRAIT.GLUTTONY,
  name: 'Gluttony',
  balance: { lifeForceGainMultiplier: 1.1 }
});

const SHADE_SKILLS = new Set<number>([
  ID.NEFARIOUS_FAVOR,
  ID.SAND_CASCADE,
  ID.GARISH_PILLAR,
  ID.DESERT_SHROUD,
  ID.MANIFEST_SAND_SHADE,
  ID.SANDSTORM_SHROUD
]);

import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetHealthBelow } from '#gw2/platform/combat/query/runtime-query.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { necromancerRuntimeCoreState } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

/** Owns Reaper's Might tuning and behavior at its existing execution boundaries. */
export const reapersMight = defineTrait({
  id: TRAIT.REAPERS_MIGHT,
  name: "Reaper's Might",
  balance: {
    effects: [
      {
        name: 'might',
        type: 'boon',
        boon: 'might',
        stacks: 1,
        duration: 15,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Siphoned Power tuning and behavior at its existing execution boundaries. */
export const siphonedPower = defineTrait({
  id: TRAIT.SIPHONED_POWER,
  name: 'Siphoned Power',
  balance: {
    cooldown: 1,
    effects: [
      {
        name: 'might',
        type: 'boon',
        boon: 'might',
        stacks: 3,
        duration: 8,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Chill of Death tuning and behavior at its existing execution boundaries. */
export const chillOfDeath = defineTrait({
  id: TRAIT.CHILL_OF_DEATH,
  name: 'Chill of Death',
  balance: {
    cooldown: 16,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        name: 'Lesser Spinal Shivers - No Boons',
        actorType: 'effect'
      },
      {
        name: 'Chilled',
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 5,
        actorType: 'effect'
      }
    ]
  }
});

/** Owns Awaken the Pain tuning and behavior at its existing execution boundaries. */
export const awakenThePain = defineTrait({
  id: TRAIT.AWAKEN_THE_PAIN,
  name: 'Awaken the Pain',
  balance: {
    effects: [{ name: 'might', type: 'boon', boon: 'might', stacks: 5, duration: 5, packetLabel: 'on shroud entry' }],
    attributePerStack: 10
  }
});

/** Owns Spiteful Fortitude tuning and behavior at its existing execution boundaries. */
export const spitefulFortitude = defineTrait({
  id: TRAIT.SPITEFUL_FORTITUDE,
  name: 'Spiteful Fortitude',
  balance: {
    attributeConversion: 0.1,
    lifeForceGain: 1
  },
  buildAttributes: traitAttributeEffects(TRAIT.SPITEFUL_FORTITUDE, [
    {
      kind: 'conversion',
      from: 'Power',
      to: 'Vitality',
      field: 'attributeConversion',
      rounding: 'none',
      input: 'common'
    }
  ])
});

/** Owns Signets of Suffering tuning and behavior at its existing execution boundaries. */
export const signetsOfSuffering = defineTrait({
  id: TRAIT.SIGNETS_OF_SUFFERING,
  name: 'Signets of Suffering',
  balance: {
    effects: [
      {
        name: 'Strike',
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 1413,
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
  },
  triggers: [
    {
      order: 1,

      on: 'castCommit',
      when: (_runtime, cast) => Boolean(cast.skill.categories?.includes('Signet')),
      emit: TRAIT.SIGNETS_OF_SUFFERING,
      effects: (effect) => effect.type === 'strike' && effect.name === 'Strike',
      attribution: (_runtime, cast) => ({
        skillId: undefined,
        skillName: 'Signets of Suffering',
        name: 'Signets of Suffering',
        triggeredBy: cast.skill.name,
        offTarget: cast.command.offTarget,
        skillWeapon: 'Unequipped'
      })
    }
  ]
});

/** Owns Bitter Chill tuning and behavior at its existing execution boundaries. */
export const bitterChill = defineTrait({
  id: TRAIT.BITTER_CHILL,
  name: 'Bitter Chill',
  balance: {
    effects: [{ name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 3, duration: 8 }]
  }
});

/** Owns Malicious Swarm tuning and behavior at its existing execution boundaries. */
export const maliciousSwarm = defineTrait({
  id: TRAIT.MALICIOUS_SWARM,
  name: 'Malicious Swarm',
  balance: {
    internalCooldown: 15,
    effects: [{ name: 'Strike', type: 'strike', coefficient: 1, hits: 1 }]
  },
  triggers: [
    {
      order: 0,

      on: 'castCommit',
      emit: TRAIT.MALICIOUS_SWARM,
      icd: 'profile',
      when: (runtime, cast) =>
        cast.skill.type === 'Heal' &&
        Boolean(requireEffect(requireBalanceProfileFromContext(runtime, TRAIT.MALICIOUS_SWARM), 'strike', 'Strike')),
      effects: (effect) => effect.type === 'strike' && effect.name === 'Strike',
      attribution: (_runtime, cast) => ({
        skillId: undefined,
        skillName: 'Lesser Signet of the Locust',
        name: 'Lesser Signet of the Locust',
        skillWeapon: 'Unequipped',
        triggeredBy: cast.skill.name,
        offTarget: cast.command.offTarget
      })
    }
  ]
});

/** Owns Spiteful Spirit tuning and behavior at its existing execution boundaries. */
export const spitefulSpirit = defineTrait({
  id: TRAIT.SPITEFUL_SPIRIT,
  name: 'Spiteful Spirit',
  balance: {
    effects: [
      {
        name: 'Strike',
        type: 'strike',
        coefficient: 1,
        hits: 1,
        actorType: 'effect'
      }
    ]
  }
});

/** Owns Dread tuning and behavior at its existing execution boundaries. */
export const dread = defineTrait({
  id: TRAIT.DREAD,
  name: 'Dread',
  modifierRules: [
    {
      order: -16,
      id: 'necromancer.dread',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.2,
      when: (context) => (necromancerRuntimeCoreState(context).dreadUntil || 0) > context.time
    }
  ]
});

/** Owns Spiteful Talisman tuning and behavior at its existing execution boundaries. */
export const spitefulTalisman = defineTrait({
  id: TRAIT.SPITEFUL_TALISMAN,
  name: 'Spiteful Talisman',
  modifierRules: [
    {
      order: 106,
      id: 'necromancer.spiteful-talisman',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.05
    }
  ]
});

/** Owns Close to Death tuning and behavior at its existing execution boundaries. */
export const closeToDeath = defineTrait({
  id: TRAIT.CLOSE_TO_DEATH,
  name: 'Close to Death',
  modifierRules: [
    {
      order: 107,
      id: 'necromancer.close-to-death',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.2,
      when: (context) => targetHealthBelow(context, 0.5)
    }
  ]
});

export const spiteTraits = [
  reapersMight,
  siphonedPower,
  chillOfDeath,
  awakenThePain,
  spitefulFortitude,
  signetsOfSuffering,
  bitterChill,
  maliciousSwarm,
  spitefulSpirit,
  dread,
  spitefulTalisman,
  closeToDeath
];

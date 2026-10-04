import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/balance-profiles.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { necromancerRuntimeSpecializationState } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { HARBINGER_BALANCE_PROFILE_IDS } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import { applyDeathlyHaste } from '#gw2/professions/necromancer/specializations/harbinger/traits/behavior.js';

/** Owns Cascading Corruption tuning and behavior at its existing execution boundaries. */
export const cascadingCorruption = defineTrait({
  id: TRAIT.CASCADING_CORRUPTION,
  name: 'Cascading Corruption',
  balance: {
    minimumStacks: 20,
    effects: [
      {
        name: 'meltdown',
        type: 'buff',
        kind: 'meltdown',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      },
      {
        name: 'Strike',
        type: 'strike',
        coefficient: 4.5,
        hits: 1,
        // The explosion lands 17 action ticks after Meltdown activates.
        atMs: 680,
        actorType: 'effect'
      },
      {
        name: 'Torment',
        type: 'condition',
        condition: 'Torment',
        stacks: 6,
        duration: 6,
        atMs: 680,
        actorType: 'effect'
      }
    ]
  },
  modifierRules: [
    {
      order: 3,
      id: 'necromancer.cascading-corruption',
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      amount: 0.1,
      // Read the emitted buff through the shared timeline, including explicitly supplied initial buffs.
      when: (context) => Boolean(context.timeline?.timedActive('meltdown', context.time))
    }
  ]
});

/** Owns Septic Corruption tuning and behavior at its existing execution boundaries. */
export const septicCorruption = defineTrait({
  id: TRAIT.SEPTIC_CORRUPTION,
  name: 'Septic Corruption',
  balance: {
    effects: [
      {
        name: 'Poisoned',
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 3,
        actorType: 'effect'
      }
    ]
  },
  modifierRules: [
    {
      order: 2,
      id: 'necromancer.septic-corruption-blight',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      parameters: { damagePerStack: 0.0025 },
      amount: (context, _target, parameters) => activeBlight(context) * parameters.damagePerStack
    }
  ]
});

/** Owns Doom Approaches tuning and behavior at its existing execution boundaries. */
export const doomApproaches = defineTrait({
  id: TRAIT.DOOM_APPROACHES,
  name: 'Doom Approaches',
  balance: {
    blightGain: 4,
    effects: [
      {
        name: 'Vulnerability',
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 6,
        actorType: 'effect'
      }
    ]
  },
  profiles: [
    variant(
      HARBINGER_BALANCE_PROFILE_IDS.darkBarrageDoomApproaches,
      ID.DARK_BARRAGE,
      'Dark Barrage — Doom Approaches',
      {
        pulseCount: 8,
        pulseInterval: 0.75 / 8,
        effects: [
          { name: 'Strike', type: 'strike', coefficient: 0.6 },
          { name: 'Torment', type: 'condition', condition: 'Torment', stacks: 1, duration: 3 }
        ]
      }
    )
  ]
});

/** Owns Deathly Haste tuning and behavior at its existing execution boundaries. */
export const deathlyHaste = defineTrait({
  id: TRAIT.DEATHLY_HASTE,
  name: 'Deathly Haste',
  balance: {
    effects: [
      {
        name: 'quickness',
        type: 'boon',
        boon: 'quickness',
        stacks: 1,
        duration: 4,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      },
      {
        name: 'fury',
        type: 'boon',
        boon: 'fury',
        stacks: 1,
        duration: 4,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      }
    ]
  },
  hooks: {
    onCastCommit(runtime, cast) {
      if (cast.skill.id === ID.DARK_BARRAGE) applyDeathlyHaste(runtime, cast.skill);
    }
  }
});

/** Owns Corrupted Talent tuning and behavior at its existing execution boundaries. */
export const corruptedTalent = defineTrait({
  id: TRAIT.CORRUPTED_TALENT,
  name: 'Corrupted Talent',
  balance: {
    lifeForceGain: 15
  }
});

/** Owns Implacable Foe tuning and behavior at its existing execution boundaries. */
export const implacableFoe = defineTrait({
  id: TRAIT.IMPLACABLE_FOE,
  name: 'Implacable Foe',
  balance: {
    attributeConversion: 0.13,
    effects: [
      {
        name: 'stability',
        type: 'boon',
        boon: 'stability',
        stacks: 3,
        duration: 5,
        actorType: 'player'
      },
      {
        name: 'implacable-foe',
        type: 'buff',
        kind: 'implacable-foe',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ]
  },
  buildAttributes: traitAttributeEffects(TRAIT.IMPLACABLE_FOE, [
    {
      kind: 'conversion',
      from: 'Vitality',
      to: 'Ferocity',
      field: 'attributeConversion',
      rounding: 'none',
      input: 'eligible'
    }
  ])
});

/** Owns Bolstering Brew tuning and behavior at its existing execution boundaries. */
export const bolsteringBrew = defineTrait({
  id: TRAIT.BOLSTERING_BREW,
  name: 'Bolstering Brew',
  balance: {
    effects: [
      {
        name: 'protection',
        type: 'boon',
        boon: 'protection',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Alchemic Vigor tuning and behavior at its existing execution boundaries. */
export const alchemicVigor = defineTrait({
  id: TRAIT.ALCHEMIC_VIGOR,
  name: 'Alchemic Vigor',
  balance: {
    attributeBonus: 240
  },
  buildAttributes: traitAttributeEffects(TRAIT.ALCHEMIC_VIGOR, [
    { kind: 'flat', to: 'Vitality', field: 'attributeBonus', feedsConversions: true }
  ])
});

/** Owns Twisted Medicine tuning and behavior at its existing execution boundaries. */
export const twistedMedicine = defineTrait({
  id: TRAIT.TWISTED_MEDICINE,
  name: 'Twisted Medicine',
  balance: {
    attributeConversion: 0.13
  },
  buildAttributes: traitAttributeEffects(TRAIT.TWISTED_MEDICINE, [
    {
      kind: 'conversion',
      from: 'Vitality',
      to: 'Concentration',
      field: 'attributeConversion',
      rounding: 'none',
      input: 'eligible'
    }
  ])
});

/** Owns Wicked Corruption tuning and behavior at its existing execution boundaries. */
export const wickedCorruption = defineTrait({
  id: TRAIT.WICKED_CORRUPTION,
  name: 'Wicked Corruption',
  balance: {
    criticalDamage: 1.1
  },
  modifierRules: [
    {
      order: 0,
      id: 'necromancer.wicked-corruption-blight',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      parameters: { damagePerStack: 0.01 },
      amount: (context, _target, parameters) => activeBlight(context) * parameters.damagePerStack
    },
    {
      order: 121,
      id: 'necromancer.wicked-corruption-critical-hit-damage',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.WICKED_CORRUPTION), 'criticalDamage'),
      when: (context) => targetConditionActive(context, 'Torment')
    }
  ]
});

/** Owns Dark Gunslinger tuning and behavior at its existing execution boundaries. */
export const darkGunslinger = defineTrait({
  id: TRAIT.DARK_GUNSLINGER,
  name: 'Dark Gunslinger',
  balance: {
    attributeConversion: 0.1,
    rechargeMultiplier: 0.8
  },
  buildAttributes: traitAttributeEffects(TRAIT.DARK_GUNSLINGER, [
    {
      kind: 'conversion',
      from: 'Vitality',
      to: 'Expertise',
      field: 'attributeConversion',
      rounding: 'round',
      input: 'eligible'
    }
  ]),
  rechargeRules: [
    {
      order: 0,

      when: (_runtime, skill) => skill.weapon === 'Pistol',
      multiplier: { profile: TRAIT.DARK_GUNSLINGER, field: 'rechargeMultiplier' }
    }
  ]
});

function activeBlight(context: Gw2ModifierContext): number {
  const event = context.event;
  // Prefer the snapshotted blight from the event so that modifier rules see the value at the moment of impact,
  // not the current (post-impact) blight count which may already be lower due to subsequent consumption.
  return Math.max(
    0,
    event?.metadata?.necromancerBlight ?? necromancerRuntimeSpecializationState(context, 'Harbinger').blight ?? 0
  );
}

/** Registers each native trait owner once in its existing execution order. */
export const necromancerHarbingerTraits = [
  cascadingCorruption,
  septicCorruption,
  doomApproaches,
  deathlyHaste,
  corruptedTalent,
  implacableFoe,
  bolsteringBrew,
  alchemicVigor,
  twistedMedicine,
  wickedCorruption,
  darkGunslinger
];

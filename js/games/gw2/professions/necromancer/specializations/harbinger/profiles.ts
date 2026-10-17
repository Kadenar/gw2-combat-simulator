import { ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { GW2_DAMAGING_CONDITIONS } from '#gw2/platform/combat/state/targets.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/profile-authoring.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

export const HARBINGER_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'necromancer.harbinger.resources',
  darkBarrageDoomApproaches: 'necromancer.harbinger.dark-barrage-doom-approaches',
  elixirOfPromiseEmpowered: 'necromancer.harbinger.elixir-of-promise-empowered',
  elixirOfRiskEmpowered: 'necromancer.harbinger.elixir-of-risk-empowered',
  elixirOfBlissEmpowered: 'necromancer.harbinger.elixir-of-bliss-empowered',
  elixirOfIgnoranceEmpowered: 'necromancer.harbinger.elixir-of-ignorance-empowered',
  elixirOfAnguishEmpowered: 'necromancer.harbinger.elixir-of-anguish-empowered',
  elixirOfAmbitionEmpowered: 'necromancer.harbinger.elixir-of-ambition-empowered',
  devouringCutEmpowered: 'necromancer.harbinger.devouring-cut-empowered',
  voraciousArcEmpowered: 'necromancer.harbinger.voracious-arc-empowered'
});

export const HARBINGER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  // Doom Approaches replaces the ordinary channel with this independently interruptible volley.

  {
    id: HARBINGER_BALANCE_PROFILE_IDS.resources,
    name: 'Harbinger Blight',
    profileKind: 'mechanic',
    maximumStacks: 25,
    lifeForceDrain: 5,
    blightGain: 2,
    pulseInterval: 1,
    effects: []
  },

  variant(
    HARBINGER_BALANCE_PROFILE_IDS.elixirOfPromiseEmpowered,
    ID.ELIXIR_OF_PROMISE,
    'Elixir of Promise - Empowered',
    {
      blightCost: 5,
      blightGain: 10,
      effects: [
        { name: 'Strike', type: 'strike', coefficient: 1.6, hits: 1, actorType: ACTOR.PLAYER },
        {
          name: CONDITION.POISONED,
          type: 'condition',
          condition: CONDITION.POISONED,
          stacks: 3,
          duration: 10,
          actorType: ACTOR.PLAYER
        }
      ]
    }
  ),
  variant(HARBINGER_BALANCE_PROFILE_IDS.elixirOfRiskEmpowered, ID.ELIXIR_OF_RISK, 'Elixir of Risk - Empowered', {
    blightCost: 5,
    blightGain: 10,
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 4, hits: 1, actorType: ACTOR.PLAYER },
      {
        name: CONDITION.TORMENT,
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 3,
        duration: 10,
        actorType: ACTOR.PLAYER
      },
      {
        name: CONDITION.WEAKNESS,
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 10,
        actorType: ACTOR.PLAYER
      },
      {
        name: boonKey(BOON.MIGHT),
        type: 'boon',
        boon: BOON.MIGHT,
        stacks: 10,
        duration: 10,
        actorType: ACTOR.PLAYER
      },
      {
        name: boonKey(BOON.FURY),
        type: 'boon',
        boon: BOON.FURY,
        stacks: 1,
        duration: 10,
        actorType: ACTOR.PLAYER
      }
    ]
  }),
  variant(HARBINGER_BALANCE_PROFILE_IDS.elixirOfBlissEmpowered, ID.ELIXIR_OF_BLISS, 'Elixir of Bliss - Empowered', {
    blightCost: 5,
    blightGain: 10,
    effects: [{ name: 'Strike', type: 'strike', coefficient: 1.6, hits: 1, actorType: ACTOR.PLAYER }]
  }),
  variant(
    HARBINGER_BALANCE_PROFILE_IDS.elixirOfIgnoranceEmpowered,
    ID.ELIXIR_OF_IGNORANCE,
    'Elixir of Ignorance - Empowered',
    {
      blightCost: 5,
      blightGain: 10,
      effects: [{ name: 'Strike', type: 'strike', coefficient: 1.6, hits: 1, actorType: ACTOR.PLAYER }]
    }
  ),
  variant(
    HARBINGER_BALANCE_PROFILE_IDS.elixirOfAnguishEmpowered,
    ID.ELIXIR_OF_ANGUISH,
    'Elixir of Anguish - Empowered',
    {
      blightCost: 5,
      blightGain: 10,
      effects: [
        { name: 'Strike', type: 'strike', coefficient: 2, hits: 1, actorType: ACTOR.PLAYER },
        {
          name: CONDITION.CRIPPLED,
          type: 'condition',
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 10,
          actorType: ACTOR.PLAYER
        },
        {
          name: boonKey(BOON.QUICKNESS),
          type: 'boon',
          boon: BOON.QUICKNESS,
          stacks: 1,
          duration: 10,
          actorType: ACTOR.PLAYER
        },
        {
          name: boonKey(BOON.SWIFTNESS),
          type: 'boon',
          boon: BOON.SWIFTNESS,
          stacks: 1,
          duration: 20,
          actorType: ACTOR.PLAYER
        }
      ]
    }
  ),
  variant(
    HARBINGER_BALANCE_PROFILE_IDS.elixirOfAmbitionEmpowered,
    ID.ELIXIR_OF_AMBITION,
    'Elixir of Ambition - Empowered',
    {
      blightCost: 10,
      blightGain: 15,
      effects: [
        { name: 'Strike', type: 'strike', coefficient: 3, hits: 1, actorType: ACTOR.PLAYER },
        // Profile totals stay editable as one effect; resolution owns Burning stack expansion.
        ...GW2_DAMAGING_CONDITIONS.map((condition) => ({
          name: condition,
          type: 'condition' as const,
          condition,
          stacks: 3,
          duration: 10,
          actorType: ACTOR.PLAYER
        })),
        {
          name: boonKey(BOON.MIGHT),
          type: 'boon',
          boon: BOON.MIGHT,
          stacks: 25,
          duration: 5,
          actorType: ACTOR.PLAYER
        },
        {
          name: boonKey(BOON.FURY),
          type: 'boon',
          boon: BOON.FURY,
          stacks: 1,
          duration: 5,
          actorType: ACTOR.PLAYER
        },
        {
          name: boonKey(BOON.QUICKNESS),
          type: 'boon',
          boon: BOON.QUICKNESS,
          stacks: 1,
          duration: 5,
          actorType: ACTOR.PLAYER
        },
        {
          name: boonKey(BOON.ALACRITY),
          type: 'boon',
          boon: BOON.ALACRITY,
          stacks: 1,
          duration: 5,
          actorType: ACTOR.PLAYER
        }
      ]
    }
  ),
  variant(HARBINGER_BALANCE_PROFILE_IDS.devouringCutEmpowered, ID.DEVOURING_CUT, 'Devouring Cut - Empowered', {
    blightCost: 5,
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 2, hits: 1, actorType: ACTOR.PLAYER },
      {
        name: CONDITION.TORMENT,
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 5,
        duration: 5,
        actorType: ACTOR.PLAYER
      }
    ]
  }),
  variant(HARBINGER_BALANCE_PROFILE_IDS.voraciousArcEmpowered, ID.VORACIOUS_ARC, 'Voracious Arc - Empowered', {
    blightCost: 5,
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 2.8, hits: 1, actorType: ACTOR.PLAYER },
      {
        name: CONDITION.TORMENT,
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 5,
        duration: 7,
        actorType: ACTOR.PLAYER
      }
    ]
  })
]);

export const HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID: Readonly<Record<number, string>> = Object.freeze({
  [ID.ELIXIR_OF_PROMISE]: HARBINGER_BALANCE_PROFILE_IDS.elixirOfPromiseEmpowered,
  [ID.ELIXIR_OF_RISK]: HARBINGER_BALANCE_PROFILE_IDS.elixirOfRiskEmpowered,
  [ID.ELIXIR_OF_BLISS]: HARBINGER_BALANCE_PROFILE_IDS.elixirOfBlissEmpowered,
  [ID.ELIXIR_OF_IGNORANCE]: HARBINGER_BALANCE_PROFILE_IDS.elixirOfIgnoranceEmpowered,
  [ID.ELIXIR_OF_ANGUISH]: HARBINGER_BALANCE_PROFILE_IDS.elixirOfAnguishEmpowered,
  [ID.ELIXIR_OF_AMBITION]: HARBINGER_BALANCE_PROFILE_IDS.elixirOfAmbitionEmpowered,
  [ID.DEVOURING_CUT]: HARBINGER_BALANCE_PROFILE_IDS.devouringCutEmpowered,
  [ID.VORACIOUS_ARC]: HARBINGER_BALANCE_PROFILE_IDS.voraciousArcEmpowered
});

import { GW2_DAMAGING_CONDITIONS } from '#gw2/platform/combat/state/targets.js';
import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/balance-profiles.js';
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
        { name: 'Strike', type: 'strike', coefficient: 1.6, hits: 1, actorType: 'player' },
        {
          name: 'Poisoned',
          type: 'condition',
          condition: 'Poisoned',
          stacks: 3,
          duration: 10,
          actorType: 'player'
        }
      ]
    }
  ),
  variant(HARBINGER_BALANCE_PROFILE_IDS.elixirOfRiskEmpowered, ID.ELIXIR_OF_RISK, 'Elixir of Risk - Empowered', {
    blightCost: 5,
    blightGain: 10,
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 4, hits: 1, actorType: 'player' },
      {
        name: 'Torment',
        type: 'condition',
        condition: 'Torment',
        stacks: 3,
        duration: 10,
        actorType: 'player'
      },
      {
        name: 'Weakness',
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      },
      {
        name: 'might',
        type: 'boon',
        boon: 'might',
        stacks: 10,
        duration: 10,
        actorType: 'player'
      },
      {
        name: 'fury',
        type: 'boon',
        boon: 'fury',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      }
    ]
  }),
  variant(HARBINGER_BALANCE_PROFILE_IDS.elixirOfBlissEmpowered, ID.ELIXIR_OF_BLISS, 'Elixir of Bliss - Empowered', {
    blightCost: 5,
    blightGain: 10,
    effects: [{ name: 'Strike', type: 'strike', coefficient: 1.6, hits: 1, actorType: 'player' }]
  }),
  variant(
    HARBINGER_BALANCE_PROFILE_IDS.elixirOfIgnoranceEmpowered,
    ID.ELIXIR_OF_IGNORANCE,
    'Elixir of Ignorance - Empowered',
    {
      blightCost: 5,
      blightGain: 10,
      effects: [{ name: 'Strike', type: 'strike', coefficient: 1.6, hits: 1, actorType: 'player' }]
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
        { name: 'Strike', type: 'strike', coefficient: 2, hits: 1, actorType: 'player' },
        {
          name: 'Crippled',
          type: 'condition',
          condition: 'Crippled',
          stacks: 1,
          duration: 10,
          actorType: 'player'
        },
        {
          name: 'quickness',
          type: 'boon',
          boon: 'quickness',
          stacks: 1,
          duration: 10,
          actorType: 'player'
        },
        {
          name: 'swiftness',
          type: 'boon',
          boon: 'swiftness',
          stacks: 1,
          duration: 20,
          actorType: 'player'
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
        { name: 'Strike', type: 'strike', coefficient: 3, hits: 1, actorType: 'player' },
        // Profile totals stay editable as one effect; resolution owns Burning stack expansion.
        ...GW2_DAMAGING_CONDITIONS.map((condition) => ({
          name: condition,
          type: 'condition' as const,
          condition,
          stacks: 3,
          duration: 10,
          actorType: 'player' as const
        })),
        {
          name: 'might',
          type: 'boon',
          boon: 'might',
          stacks: 25,
          duration: 5,
          actorType: 'player'
        },
        {
          name: 'fury',
          type: 'boon',
          boon: 'fury',
          stacks: 1,
          duration: 5,
          actorType: 'player'
        },
        {
          name: 'quickness',
          type: 'boon',
          boon: 'quickness',
          stacks: 1,
          duration: 5,
          actorType: 'player'
        },
        {
          name: 'alacrity',
          type: 'boon',
          boon: 'alacrity',
          stacks: 1,
          duration: 5,
          actorType: 'player'
        }
      ]
    }
  ),
  variant(HARBINGER_BALANCE_PROFILE_IDS.devouringCutEmpowered, ID.DEVOURING_CUT, 'Devouring Cut - Empowered', {
    blightCost: 5,
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 2, hits: 1, actorType: 'player' },
      {
        name: 'Torment',
        type: 'condition',
        condition: 'Torment',
        stacks: 5,
        duration: 5,
        actorType: 'player'
      }
    ]
  }),
  variant(HARBINGER_BALANCE_PROFILE_IDS.voraciousArcEmpowered, ID.VORACIOUS_ARC, 'Voracious Arc - Empowered', {
    blightCost: 5,
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 2.8, hits: 1, actorType: 'player' },
      {
        name: 'Torment',
        type: 'condition',
        condition: 'Torment',
        stacks: 5,
        duration: 7,
        actorType: 'player'
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

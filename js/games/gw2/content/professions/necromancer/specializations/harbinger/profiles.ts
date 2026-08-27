import type { BalanceProfile } from '../../../../../platform/engine/types.js';
import {
  defineSkillVariantProfile as variant,
  defineTraitProfile as trait
} from '../../../../../integrations/patches/authoring/balance-profiles.js';
import { GW2_DAMAGING_CONDITIONS } from '../../../../../platform/combat/state/targets.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '../../data/ids.js';

export const HARBINGER_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'necromancer.harbinger.resources',
  cascadingCorruption: TRAIT.CASCADING_CORRUPTION,
  septicCorruption: TRAIT.SEPTIC_CORRUPTION,
  doomApproaches: TRAIT.DOOM_APPROACHES,
  deathlyHaste: TRAIT.DEATHLY_HASTE,
  corruptedTalent: TRAIT.CORRUPTED_TALENT,
  implacableFoe: TRAIT.IMPLACABLE_FOE,
  bolsteringBrew: TRAIT.BOLSTERING_BREW,
  alchemicVigor: TRAIT.ALCHEMIC_VIGOR,
  twistedMedicine: TRAIT.TWISTED_MEDICINE,
  darkGunslinger: TRAIT.DARK_GUNSLINGER,
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
  trait(HARBINGER_BALANCE_PROFILE_IDS.cascadingCorruption, 'Cascading Corruption', {
    minimumStacks: 20,
    effects: [
      {
        type: 'buff',
        kind: 'meltdown',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 4.5,
        hits: 1,
        actorType: 'effect'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 6,
        duration: 6,
        actorType: 'effect'
      }
    ]
  }),
  trait(HARBINGER_BALANCE_PROFILE_IDS.septicCorruption, 'Septic Corruption', {
    effects: [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 3,
        actorType: 'effect'
      }
    ]
  }),
  trait(HARBINGER_BALANCE_PROFILE_IDS.doomApproaches, 'Doom Approaches', {
    blightGain: 4,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 6,
        actorType: 'effect'
      }
    ]
  }),
  trait(HARBINGER_BALANCE_PROFILE_IDS.deathlyHaste, 'Deathly Haste', {
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        stacks: 1,
        duration: 4,
        actorType: 'player',
        recipients: 'party'
      },
      {
        type: 'boon',
        boon: 'fury',
        stacks: 1,
        duration: 4,
        actorType: 'player',
        recipients: 'party'
      }
    ]
  }),
  trait(HARBINGER_BALANCE_PROFILE_IDS.corruptedTalent, 'Corrupted Talent', {
    lifeForceGain: 15
  }),
  trait(HARBINGER_BALANCE_PROFILE_IDS.implacableFoe, 'Implacable Foe', {
    attributeConversion: 0.13,
    effects: [
      {
        type: 'boon',
        boon: 'stability',
        stacks: 3,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'buff',
        kind: 'implacable-foe',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ]
  }),
  trait(HARBINGER_BALANCE_PROFILE_IDS.bolsteringBrew, 'Bolstering Brew', {
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  }),
  trait(HARBINGER_BALANCE_PROFILE_IDS.alchemicVigor, 'Alchemic Vigor', {
    attributeBonus: 240
  }),
  trait(HARBINGER_BALANCE_PROFILE_IDS.twistedMedicine, 'Twisted Medicine', {
    attributeConversion: 0.13
  }),
  trait(HARBINGER_BALANCE_PROFILE_IDS.darkGunslinger, 'Dark Gunslinger', {
    attributeConversion: 0.1,
    rechargeMultiplier: 0.8
  }),
  variant(
    HARBINGER_BALANCE_PROFILE_IDS.elixirOfPromiseEmpowered,
    ID.ELIXIR_OF_PROMISE,
    'Elixir of Promise - Empowered',
    {
      blightCost: 5,
      blightGain: 10,
      effects: [
        { type: 'strike', coefficient: 1.6, hits: 1, actorType: 'player' },
        {
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
      { type: 'strike', coefficient: 4, hits: 1, actorType: 'player' },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 3,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        stacks: 10,
        duration: 10,
        actorType: 'player'
      },
      {
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
    effects: [{ type: 'strike', coefficient: 1.6, hits: 1, actorType: 'player' }]
  }),
  variant(
    HARBINGER_BALANCE_PROFILE_IDS.elixirOfIgnoranceEmpowered,
    ID.ELIXIR_OF_IGNORANCE,
    'Elixir of Ignorance - Empowered',
    {
      blightCost: 5,
      blightGain: 10,
      effects: [{ type: 'strike', coefficient: 1.6, hits: 1, actorType: 'player' }]
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
        { type: 'strike', coefficient: 2, hits: 1, actorType: 'player' },
        {
          type: 'condition',
          condition: 'Crippled',
          stacks: 1,
          duration: 10,
          actorType: 'player'
        },
        {
          type: 'boon',
          boon: 'quickness',
          stacks: 1,
          duration: 10,
          actorType: 'player'
        },
        {
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
        { type: 'strike', coefficient: 3, hits: 1, actorType: 'player' },
        ...GW2_DAMAGING_CONDITIONS.map((condition) => ({
          type: 'condition',
          condition,
          stacks: 3,
          duration: 10,
          actorType: 'player'
        })),
        {
          type: 'boon',
          boon: 'might',
          stacks: 25,
          duration: 5,
          actorType: 'player'
        },
        {
          type: 'boon',
          boon: 'fury',
          stacks: 1,
          duration: 5,
          actorType: 'player'
        },
        {
          type: 'boon',
          boon: 'quickness',
          stacks: 1,
          duration: 5,
          actorType: 'player'
        },
        {
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
      { type: 'strike', coefficient: 2, hits: 1, actorType: 'player' },
      {
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
      { type: 'strike', coefficient: 2.8, hits: 1, actorType: 'player' },
      {
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

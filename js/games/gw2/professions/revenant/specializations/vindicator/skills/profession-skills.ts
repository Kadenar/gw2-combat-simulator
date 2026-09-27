/** Owns Vindicator profession actions, stance identities, and legend-call fragments. */
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { VINDICATOR_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/vindicator/profiles.js';
import type { SkillSideEffect } from '#gw2/platform/simulation/side-effects.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// Song replaces the live skill's endurance reward; the two declarations are mutually exclusive.
const energyMeldRewards: readonly SkillSideEffect[] = [
  {
    on: 'castCommit',
    when: (runtime) => !hasTrait(runtime, TRAIT.SONG_OF_ARBOREUM),
    do: { type: 'resourceGrant', resource: 'endurance', amount: { skillField: 'resourceGain' } }
  },
  {
    on: 'castCommit',
    when: (runtime) => hasTrait(runtime, TRAIT.SONG_OF_ARBOREUM),
    do: {
      type: 'resourceGrant',
      resource: 'endurance',
      amount: { profile: PROFILE.songOfArboreum, field: 'resourceGain' }
    }
  }
];

export const VINDICATOR_PROFESSION_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.LEGENDARY_ALLIANCE_STANCE_ID_62749]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.ENERGY_MELD]: {
    castTimeMs: 440,
    cooldown: 20,
    energyCost: 10,
    resourceGain: 25,
    sideEffects: energyMeldRewards,
    effects: []
  },
  [ID.ENERGY_MELD_ID_72058]: {
    castTimeMs: 440,
    cooldown: 20,
    energyCost: 10,
    resourceGain: 25,
    sideEffects: energyMeldRewards,
    effects: []
  },
  [ID.CALL_OF_THE_ALLIANCE]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    resourceGain: 8,
    effects: [
      {
        type: 'strike',
        coefficient: 0.93,
        hits: 1,
        name: 'Call of the Alliance',
        actorType: 'player'
      }
    ]
  },
  [ID.LEGENDARY_ALLIANCE_STANCE]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  }
});

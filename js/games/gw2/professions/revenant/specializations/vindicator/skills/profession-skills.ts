import { ACTOR } from '#gw2/platform/constants.js';
import type { SkillSideEffect } from '#gw2/platform/effects/actions.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { songOfArboreumSelected } from '#gw2/professions/revenant/specializations/vindicator/traits/behavior.js';

/** Energy Meld grants its ordinary endurance unless the trait replaces that reward. */
const energyMeldRewards: readonly SkillSideEffect[] = [
  {
    on: 'castCommit',
    when: (runtime) => !songOfArboreumSelected(runtime),
    do: { type: 'resourceGrant', resource: 'endurance', amount: { skillField: 'resourceGain' } }
  },
  { on: 'castCommit', do: { type: 'revenant.energy-meld-endurance' } }
];

export const VINDICATOR_PROFESSION_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.LEGENDARY_ALLIANCE_STANCE_ID_62749]: {
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 0,
    effects: []
  },
  [ID.ENERGY_MELD]: {
    cooldown: 20,
    energyCost: 10,
    resourceGain: 25,
    castTimeMs: 440,
    effects: [],
    sideEffects: energyMeldRewards
  },
  [ID.ENERGY_MELD_ID_72058]: {
    cooldown: 20,
    energyCost: 10,
    resourceGain: 25,
    castTimeMs: 440,
    effects: [],
    sideEffects: energyMeldRewards
  },
  [ID.CALL_OF_THE_ALLIANCE]: {
    cooldown: 0,
    energyCost: 0,
    resourceGain: 8,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.93,
        hits: 1,
        name: 'Call of the Alliance',
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.LEGENDARY_ALLIANCE_STANCE]: {
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 0,
    effects: []
  }
});

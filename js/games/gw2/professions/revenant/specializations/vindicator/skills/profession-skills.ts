import type { Skill } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { energyMeldRewards } from '#gw2/professions/revenant/specializations/vindicator/traits/behavior.js';

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

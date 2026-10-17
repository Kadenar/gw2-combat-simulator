import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
/** Owns Core Revenant supplemental skill identities that have no narrower catalog family. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const REVENANT_SUPPLEMENTAL_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.INVOKE_TORMENT]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Invoke Torment',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 1,
        duration: 10,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  // The log's hit identity is not a second player input; import resolves it to the Greatsword activation.
  [ID.PHANTOMS_ONSLAUGHT_ID_62713]: {
    simulatorExcluded: true,
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.BLITZ_MINES]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Blitz Mines',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.SLOW,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      }
    ]
  }
});

/** Owns Core Revenant supplemental skill identities that have no narrower catalog family. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { REVENANT_WEAPONS_GREATSWORD_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/weapons/greatsword.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const REVENANT_SUPPLEMENTAL_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.HEALING_ORB]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  },
  [ID.UNCHAINED_DESOLATION]: {
    castTimeMs: 2000,
    cooldown: 5,
    energyCost: 0,
    effects: []
  },
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
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      }
    ]
  },
  // Preserve the follow-up ID while keeping the combined cast's mechanics owned by Greatsword.
  [ID.PHANTOMS_ONSLAUGHT_ID_62713]: REVENANT_WEAPONS_GREATSWORD_SKILL_MECHANICS[ID.PHANTOMS_ONSLAUGHT],
  [ID.OTHERWORLDLY_ATTRACTION_ALLY]: {
    castTimeMs: 0,
    cooldown: 5,
    energyCost: 10,
    effects: []
  },
  [ID.OTHERWORLDLY_ATTRACTION_ENEMY]: {
    castTimeMs: 500,
    cooldown: 0,
    energyCost: 10,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 6,
        duration: 10,
        actorType: 'player'
      }
    ]
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
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  }
});

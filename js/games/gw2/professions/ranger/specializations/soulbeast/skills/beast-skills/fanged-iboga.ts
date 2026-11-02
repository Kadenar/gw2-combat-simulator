/**
 * Owns Soulbeast merged-pet skill definitions for the Fanged Iboga family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

export const SOULBEAST_FANGED_IBOGA_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RangerSkill>>> = {
  [ID.NARCOTIC_SPORES]: {
    name: 'Narcotic Spores',
    icon: 'https://render.guildwars2.com/file/510AE44E0E0452005337386A66526522F817424E/1770581.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 15,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 6,
        atMs: 0
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 6,
        duration: 8
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 6,
        duration: 3
      }
    ]
  },
  [ID.CRIPPLING_ANGUISH]: {
    name: 'Crippling Anguish',
    icon: 'https://render.guildwars2.com/file/DF000038FF639A0601ECBC46222467D6FECE7046/1770580.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 10,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 3,
        duration: 3
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 2,
        duration: 6
      }
    ]
  }
};

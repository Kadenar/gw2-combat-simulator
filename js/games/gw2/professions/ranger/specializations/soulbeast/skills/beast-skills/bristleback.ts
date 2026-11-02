/**
 * Owns Soulbeast merged-pet skill definitions for the Bristleback family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

export const SOULBEAST_BRISTLEBACK_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RangerSkill>>> = {
  [ID.RAIN_OF_SPIKES]: {
    name: 'Rain of Spikes',
    icon: 'https://render.guildwars2.com/file/081DA91623067F55251BA496B2BDB91E98CDC667/1128606.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 18,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 2,
        duration: 5
      }
    ]
  },
  [ID.SHARPEN_SPINES]: {
    name: 'Sharpen Spines',
    icon: 'https://render.guildwars2.com/file/D99AA4CC69C7D510A6632D9FC87852A13524BA7F/1128607.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 30,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 5
      }
    ]
  }
};

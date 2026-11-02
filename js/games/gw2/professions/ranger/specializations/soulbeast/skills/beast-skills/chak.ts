/**
 * Owns Soulbeast merged-pet skill definitions for the Chak family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

export const SOULBEAST_CHAK_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RangerSkill>>> = {
  [ID.ELECTROCUTE]: {
    name: 'Electrocute',
    icon: 'https://render.guildwars2.com/file/5C800D284EF75CA76EE34868E35FEFD3F7964E22/3256377.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 10,
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
        condition: CONDITION.VULNERABILITY,
        stacks: 8,
        duration: 8
      }
    ]
  },
  [ID.SPIT_GOOP]: {
    name: 'Spit Goop',
    icon: 'https://render.guildwars2.com/file/43EE71676B2773FF9EA57A14653EEA3FFE32B0BF/3256379.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 15,
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
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 3
      }
    ]
  }
};

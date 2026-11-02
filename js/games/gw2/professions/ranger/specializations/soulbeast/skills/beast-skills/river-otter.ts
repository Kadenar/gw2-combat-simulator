/**
 * Owns Soulbeast merged-pet skill definitions for the River Otter family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

export const SOULBEAST_RIVER_OTTER_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RangerSkill>>> = {
  [ID.TAIL_WHIP]: {
    name: 'Tail Whip',
    icon: 'https://render.guildwars2.com/file/A7179EB9654498EC366C0012246DCE91AD3D68B5/3772577.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 15,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.3,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 3
      }
    ]
  },
  [ID.JET]: {
    name: 'Jet',
    icon: 'https://render.guildwars2.com/file/E839D32DEC66ACF974A59478370BA810C54CCC5D/3772575.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 24,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  }
};

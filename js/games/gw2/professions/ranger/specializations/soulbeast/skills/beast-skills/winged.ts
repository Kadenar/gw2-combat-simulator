/**
 * Owns the Soulbeast Wing Buffet definition shared by Wyvern and Phoenix pets.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

export const SOULBEAST_WINGED_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RangerSkill>>> = {
  [ID.WING_BUFFET]: {
    name: 'Wing Buffet',
    icon: 'https://render.guildwars2.com/file/92D7CB40ACE0A9061DD8F5722327E4F515BFCE35/1128618.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 25,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1
      }
    ]
  }
};

/**
 * Owns Soulbeast merged-pet skill definitions for the Ursine family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

export const SOULBEAST_URSINE_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RangerSkill>>> = {
  [ID.DEFY_PAIN]: {
    name: 'Defy Pain',
    icon: 'https://render.guildwars2.com/file/2A79C7DD0AFEEFC9C1D1C9E20845CA140734CE27/103951.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 40,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: []
  },
  [ID.BITE_ID_43136]: {
    name: 'Bite',
    icon: 'https://render.guildwars2.com/file/227F40E05A02AAE91EFA01EC1C35E6465F56CE09/104037.png',
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
      }
    ]
  }
};

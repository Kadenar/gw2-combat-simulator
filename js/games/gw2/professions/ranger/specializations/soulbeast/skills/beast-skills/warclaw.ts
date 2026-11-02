/**
 * Owns Soulbeast merged-pet skill definitions for the Warclaw family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

export const SOULBEAST_WARCLAW_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RangerSkill>>> = {
  [ID.BATTLE_MAUL]: {
    name: 'Battle Maul',
    icon: 'https://render.guildwars2.com/file/7F07067F9ADD0BB42406165C060F422E63EFB1AC/3379167.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 10,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 4
      }
    ]
  },
  [ID.BOP]: {
    name: 'Bop',
    icon: 'https://render.guildwars2.com/file/B7474B75A6C14CE0FF295523AADCA5A5F2C1621B/3379168.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 14,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      }
    ]
  }
};

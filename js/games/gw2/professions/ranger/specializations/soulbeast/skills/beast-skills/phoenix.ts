/**
 * Owns Soulbeast merged-pet skill definitions for the Phoenix family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

export const SOULBEAST_PHOENIX_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RangerSkill>>> = {
  [ID.DASH]: {
    name: 'Dash',
    icon: 'https://render.guildwars2.com/file/321CD26F340F3B930A04104D61E40F0C37589BB8/2604862.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 15,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1
      }
    ]
  }
};

/**
 * Owns Soulbeast merged-pet skill definitions for the Feline family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

export const SOULBEAST_FELINE_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RangerSkill>>> = {
  [ID.BITE]: {
    name: 'Bite',
    icon: 'https://render.guildwars2.com/file/520693759A79FD464CA7AD08947D10B4B50F7A96/103516.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 8,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.98,
        hits: 1,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.MAUL_ID_44514]: {
    name: 'Maul',
    icon: 'https://render.guildwars2.com/file/D5420B910EE4DA1D2F63AEC71F4DF862E414D6E1/103515.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 16,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 2,
        atMs: 0
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 4,
        duration: 10
      }
    ]
  }
};

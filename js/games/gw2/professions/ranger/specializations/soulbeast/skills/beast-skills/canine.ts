/**
 * Owns Soulbeast merged-pet skill definitions for the Canine family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

export const SOULBEAST_CANINE_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RangerSkill>>> = {
  [ID.BRUTAL_CHARGE]: {
    name: 'Brutal Charge',
    icon: 'https://render.guildwars2.com/file/06614FF537DBD771DE67B341BA0CA565B24F0A67/103239.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 20,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.64,
        hits: 1
      }
    ]
  },
  [ID.CRIPPLING_LEAP]: {
    name: 'Crippling Leap',
    icon: 'https://render.guildwars2.com/file/09990305A163E3BC2DF2E9D1D2BA93F2ECE8BA3E/103610.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 10,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.98,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 5
      }
    ]
  }
};

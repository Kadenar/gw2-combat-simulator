/**
 * Owns Soulbeast merged-pet skill definitions for the Wyvern family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const SOULBEAST_WYVERN_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.TAIL_LASH_ID_46386]: {
    name: 'Tail Lash',
    description: 'Sweep your foes along the ground, crippling them.',
    icon: 'https://render.guildwars2.com/file/64AE4727D3ED086398704B9FD0DC7403F20535EA/1128617.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 12,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 4
      }
    ]
  }
});

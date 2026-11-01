/**
 * Owns Soulbeast merged-pet skill definitions for the Jacaranda family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { BOON, CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const SOULBEAST_JACARANDA_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.PHOTOSYNTHESIZE]: {
    name: 'Photosynthesize',
    description: 'Restore health, gain regeneration, and remove conditions.',
    icon: 'https://render.guildwars2.com/file/976A0CC4EA0F36C8A4A705FDE22F03D65CD050D1/1770577.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 20,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: BOON.REGENERATION,
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.CALL_LIGHTNING_ID_43788]: {
    name: 'Call Lightning',
    description: 'Calls lightning to a small area.',
    icon: 'https://render.guildwars2.com/file/731C0827CBB7E4015F3C45B4C49C58B42416BFA8/1770576.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 15,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 5,
        atMs: 0
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 5,
        duration: 6
      }
    ]
  }
});

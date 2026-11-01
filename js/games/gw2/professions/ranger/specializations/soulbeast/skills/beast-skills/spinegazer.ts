/**
 * Owns Soulbeast merged-pet skill definitions for the Spinegazer family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const SOULBEAST_SPINEGAZER_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.TORMENTING_VISIONS]: {
    name: 'Tormenting Visions',
    description: 'Send distressing thoughts to your enemy to torment them.',
    icon: 'https://render.guildwars2.com/file/CE7504440B0506240A599CF3C4F2B99D67354278/3307110.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 15,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 4,
        atMs: 0
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 8,
        duration: 6
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 4,
        duration: 6
      }
    ]
  },
  [ID.STARING_VOID]: {
    name: 'Staring Void',
    description: 'Blast demonic energy in front of you, inflicting conditions on enemies it hits.',
    icon: 'https://render.guildwars2.com/file/777947803A61702E26031830CC27634B5A1EA756/3307109.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 12,
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
        condition: CONDITION.CONFUSION,
        stacks: 6,
        duration: 6
      }
    ]
  }
});

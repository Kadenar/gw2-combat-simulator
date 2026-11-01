/**
 * Owns Soulbeast merged-pet skill definitions for the Drake family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const SOULBEAST_DRAKE_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.CHOMP]: {
    name: 'Chomp',
    description: 'Bite a foe and gain health.',
    icon: 'https://render.guildwars2.com/file/B2BF7C5345F094BA02D83575BC4DB8A0B9DCB490/103595.png',
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
  },
  [ID.TAIL_SWIPE]: {
    name: 'Tail Swipe',
    description: 'Attack all surrounding foes with a tail swipe.',
    icon: 'https://render.guildwars2.com/file/150DEE60799B04CF20A66DE020A81DA7D4D139A4/103596.png',
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
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 5
      }
    ]
  }
});

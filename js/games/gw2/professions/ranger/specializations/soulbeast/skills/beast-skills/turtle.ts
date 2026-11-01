/**
 * Owns Soulbeast merged-pet skill definitions for the Turtle family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const SOULBEAST_TURTLE_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.SLAM]: {
    name: 'Slam',
    description: 'Leap and knock nearby foes back.',
    icon: 'https://render.guildwars2.com/file/42093A336F337E45FD91B058E12864E738D83E42/2604868.png',
    type: 'Profession',
    slot: 'Profession_1',
    cooldown: 25,
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
  [ID.HEAVY_SHOT]: {
    name: 'Heavy Shot',
    description: 'Shoot a jade missile at your target that dazes nearby enemies on impact.',
    icon: 'https://render.guildwars2.com/file/7D451452DD3DC3B6D1AF52B397F5AF91B7AEC24B/2565744.png',
    type: 'Profession',
    slot: 'Profession_2',
    cooldown: 20,
    beastmodeSkill: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1
      }
    ]
  }
});

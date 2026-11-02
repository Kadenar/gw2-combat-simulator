/**
 * Owns Soulbeast merged-pet skill definitions for the Raptor Swiftwing family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

export const SOULBEAST_RAPTOR_SWIFTWING_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RangerSkill>>> =
  {
    [ID.LEAPING_LIZARD]: {
      name: 'Leaping Lizard',
      icon: 'https://render.guildwars2.com/file/4BACB4F4A1A9BABF560CDF59A9016CDEB516E571/3713167.png',
      type: 'Profession',
      slot: 'Profession_2',
      cooldown: 15,
      beastmodeSkill: true,
      castTimeMs: 0,
      effects: [
        {
          type: 'strike',
          coefficient: 2,
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
    [ID.SAURIAN_MIGHT]: {
      name: 'Saurian Might',
      icon: 'https://render.guildwars2.com/file/6A21666A796F0FCC59C513DAEAF6073161034004/3713166.png',
      type: 'Profession',
      slot: 'Profession_1',
      cooldown: 15,
      beastmodeSkill: true,
      castTimeMs: 0,
      effects: [
        {
          type: 'strike',
          coefficient: 2,
          hits: 1
        },
        {
          type: 'condition',
          condition: CONDITION.BLEEDING,
          stacks: 4,
          duration: 8
        }
      ]
    }
  };

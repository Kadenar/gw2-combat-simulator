/**
 * Owns Core Ranger pet skill definitions for the River Otter family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_RIVER_OTTER_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.INNOCENT_DISPLAY]: definePetSkill({
    name: 'Innocent Display',
    icon: 'https://render.guildwars2.com/file/6548D0084D2F2D639EF62F60CBAA1712ABAA0127/3772574.png',
    petNames: ['River Otter'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 24,
    quicknessCastTimeMs: 1167,
    effects: [
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  })
};

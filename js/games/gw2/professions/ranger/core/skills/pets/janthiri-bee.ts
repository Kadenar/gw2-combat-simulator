/**
 * Owns Core Ranger pet skill definitions for the Janthiri Bee family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_JANTHIRI_BEE_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  // Natural Nibble uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.JANTHIRI_BEE_NIBBLE]: definePetSkill({
    name: 'Nibble',
    icon: new URL('@images/wiki/nibble.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Janthiri Bee'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.JANTHIRI_BEE_NIBBLE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.JANTHIRI_BEE_NIBBLE]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.25,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  // Natural Bumble uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.JANTHIRI_BEE_BUMBLE]: definePetSkill({
    name: 'Bumble',
    icon: 'https://render.guildwars2.com/file/DCA96000060D21F6E4A9600DB3D8A90CE8AB574B/3594073.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Janthiri Bee'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 24,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.JANTHIRI_BEE_BUMBLE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.JANTHIRI_BEE_BUMBLE]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'control',
        controlKind: CONTROL.KNOCKDOWN,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  // Natural Stinging Sorrow uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.JANTHIRI_BEE_STINGING_SORROW]: definePetSkill({
    name: 'Stinging Sorrow',
    icon: 'https://render.guildwars2.com/file/7869ABC7D2937825AD34ECEEF9014801BA11EB53/3594076.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Janthiri Bee'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.JANTHIRI_BEE_STINGING_SORROW]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.JANTHIRI_BEE_STINGING_SORROW]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 4,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 4,
        duration: 7,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.HONEY_TOSS]: definePetSkill({
    name: 'Honey Toss',
    icon: 'https://render.guildwars2.com/file/A498FD1BEC7AA69FE91B010516050B084DB42626/3594074.png',
    petNames: ['Janthiri Bee'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 25,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.SLOW,
        stacks: 1,
        duration: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  })
};

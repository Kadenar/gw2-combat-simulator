/**
 * Owns Core Ranger pet skill definitions for the Wyvern family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_WYVERN_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  // Natural Wing Swipe uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.WYVERN_WING_SWIPE]: definePetSkill({
    name: 'Wing Swipe',
    icon: new URL('@images/wiki/wing-swipe.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Electric Wyvern', 'Fire Wyvern'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WYVERN_WING_SWIPE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WYVERN_WING_SWIPE]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 2,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  // Natural Tail Lash uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.WYVERN_TAIL_LASH]: definePetSkill({
    name: 'Tail Lash',
    icon: 'https://render.guildwars2.com/file/64AE4727D3ED086398704B9FD0DC7403F20535EA/1128617.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Electric Wyvern', 'Fire Wyvern'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 12,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WYVERN_TAIL_LASH]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WYVERN_TAIL_LASH]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 6,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  // Natural Wing Buffet uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.WYVERN_WING_BUFFET]: definePetSkill({
    name: 'Wing Buffet',
    icon: 'https://render.guildwars2.com/file/92D7CB40ACE0A9061DD8F5722327E4F515BFCE35/1128618.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Electric Wyvern', 'Fire Wyvern'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 25,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WYVERN_WING_BUFFET]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WYVERN_WING_BUFFET]!.quicknessCastTimeMs,
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
        type: 'control',
        controlKind: CONTROL.LAUNCH,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.LIGHTNING_ASSAULT]: definePetSkill({
    name: 'Lightning Assault',
    icon: 'https://render.guildwars2.com/file/B35FA64E076A65E11A2F03E61DD2373F5A20CEFD/1128616.png',
    petNames: ['Electric Wyvern'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 30,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.CONSUMING_FLAME]: definePetSkill({
    name: 'Consuming Flame',
    icon: 'https://render.guildwars2.com/file/08606C1E5DCAB32DF2A991A207083CCDF1BB7F51/1128615.png',
    petNames: ['Fire Wyvern'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 25,
    quicknessCastTimeMs: 1667,
    effects: [
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  })
};

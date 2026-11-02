/**
 * Owns Core Ranger pet skill definitions for the Spinegazer family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_SPINEGAZER_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  // Natural Evil Eye uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.SPINEGAZER_EVIL_EYE]: definePetSkill({
    name: 'Evil Eye',
    icon: new URL('@images/wiki/evil-eye.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Spinegazer'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPINEGAZER_EVIL_EYE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPINEGAZER_EVIL_EYE]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.45,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        projectile: true
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  // Natural Tormenting Visions uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.SPINEGAZER_TORMENTING_VISIONS]: definePetSkill({
    name: 'Tormenting Visions',
    icon: 'https://render.guildwars2.com/file/CE7504440B0506240A599CF3C4F2B99D67354278/3307110.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Spinegazer'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPINEGAZER_TORMENTING_VISIONS]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPINEGAZER_TORMENTING_VISIONS]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 6,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        projectile: true
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 6,
        duration: 6,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  // Natural Staring Void uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.SPINEGAZER_STARING_VOID]: definePetSkill({
    name: 'Staring Void',
    icon: 'https://render.guildwars2.com/file/777947803A61702E26031830CC27634B5A1EA756/3307109.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Spinegazer'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 15,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPINEGAZER_STARING_VOID]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPINEGAZER_STARING_VOID]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: 'Blinded',
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 6,
        duration: 6,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.PANOPTICON]: definePetSkill({
    name: 'Panopticon',
    icon: 'https://render.guildwars2.com/file/B17905FB0792790A7EC1C52D193DC89F0F603BC3/3307108.png',
    petNames: ['Spinegazer'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 667,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  })
};

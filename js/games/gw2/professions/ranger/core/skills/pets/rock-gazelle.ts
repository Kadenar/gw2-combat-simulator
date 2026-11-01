/**
 * Owns Core Ranger pet skill definitions for the Rock Gazelle family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_ROCK_GAZELLE_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  // Natural Headbutt uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.ROCK_GAZELLE_HEADBUTT]: definePetSkill({
    name: 'Headbutt',
    description: ' Bash your target.',
    icon: new URL('@images/wiki/headbutt-gazelle.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Rock Gazelle'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.ROCK_GAZELLE_HEADBUTT]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.ROCK_GAZELLE_HEADBUTT]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.415,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  // Natural Kick uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.ROCK_GAZELLE_KICK]: definePetSkill({
    name: 'Kick',
    description: ' Kick your enemy.',
    icon: 'https://render.guildwars2.com/file/2ADAEF05DE5D0F031ACE310DB425E01CE7180416/1770575.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Rock Gazelle'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 8,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.ROCK_GAZELLE_KICK]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.ROCK_GAZELLE_KICK]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 1.55,
        hits: 5,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 5,
        duration: 8,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  // Natural Charge uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.ROCK_GAZELLE_CHARGE]: definePetSkill({
    name: 'Charge',
    description: ' Charge at your target.',
    icon: 'https://render.guildwars2.com/file/9E1718ECB696EBE63CF7EE700306D2090DD8084B/1770573.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Rock Gazelle'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 15,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.ROCK_GAZELLE_CHARGE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.ROCK_GAZELLE_CHARGE]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        comboFinishers: [
          {
            ownerId: 'ranger',
            ownerActorType: ACTOR.SUMMON,
            finisherType: COMBO_FINISHER.LEAP
          }
        ]
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE,
        duration: 2,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.HEAD_TOSS]: definePetSkill({
    name: 'Head Toss',
    description: 'Beast. Toss your foe into the air.',
    icon: 'https://render.guildwars2.com/file/313824ACD4211D7E76011D07B7B814C1B995E9CA/1770560.png',
    petNames: ['Rock Gazelle'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1.11,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  })
});

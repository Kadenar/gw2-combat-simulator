/**
 * Owns Core Ranger pet skill definitions for the Drake family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_DRAKE_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  // Natural Bite uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.DRAKE_BITE]: definePetSkill({
    name: 'Bite',
    icon: new URL('@images/wiki/bite-drake.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Salamander Drake', 'Marsh Drake', 'Ice Drake', 'River Drake', 'Reef Drake'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.DRAKE_BITE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.DRAKE_BITE]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.3425,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  // Natural Tail Swipe uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.DRAKE_TAIL_SWIPE]: definePetSkill({
    name: 'Tail Swipe',
    icon: 'https://render.guildwars2.com/file/150DEE60799B04CF20A66DE020A81DA7D4D139A4/103596.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Salamander Drake', 'Marsh Drake', 'Ice Drake', 'River Drake', 'Reef Drake'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 16,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.DRAKE_TAIL_SWIPE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.DRAKE_TAIL_SWIPE]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        comboFinishers: [
          {
            ownerId: 'ranger',
            ownerActorType: ACTOR.SUMMON,
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 5,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.FIRE_BREATH]: definePetSkill({
    name: 'Fire Breath',
    icon: 'https://render.guildwars2.com/file/D6D964AD6F784A4CEAA2D0CE7C5F542213D635D0/102890.png',
    petNames: ['Salamander Drake'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 5,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 5,
        duration: 3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.INSECT_SWARM]: definePetSkill({
    name: 'Insect Swarm',
    icon: 'https://render.guildwars2.com/file/3F1A0AF31F0AEC0BCB120B0C730DADB7C6ABC090/104043.png',
    petNames: ['Marsh Drake'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 5,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 5,
        duration: 4,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.FROST_BREATH]: definePetSkill({
    name: 'Frost Breath',
    icon: 'https://render.guildwars2.com/file/C9CC5F16B1371B524005D5CB995797411A2F021A/104040.png',
    petNames: ['Ice Drake'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 25,
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 5,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 5,
        duration: 2,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.LIGHTNING_BREATH]: definePetSkill({
    name: 'Lightning Breath',
    icon: 'https://render.guildwars2.com/file/59A1097728F7E50F54CC992D52F7ACF64411A1D8/104041.png',
    petNames: ['River Drake'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 1.65,
        hits: 5,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.SONIC_SHRIEK]: definePetSkill({
    name: 'Sonic Shriek',
    icon: 'https://render.guildwars2.com/file/7D0139B155352CEA660D19EEBB01EE5C941980E5/514415.png',
    petNames: ['Reef Drake'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 5,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 10,
        duration: 5,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 10,
        duration: 3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  })
};

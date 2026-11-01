/**
 * Owns Core Ranger pet skill definitions for the Smokescale family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, BOON, COMBO_FIELD, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_SMOKESCALE_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  // Natural Bite uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.SMOKESCALE_BITE]: definePetSkill({
    name: 'Bite',
    description: 'Bite your target.',
    icon: new URL('@images/wiki/bite-smokescale.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Smokescale'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0.25,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SMOKESCALE_BITE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SMOKESCALE_BITE]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.56,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  // Natural Takedown uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.SMOKESCALE_TAKEDOWN]: definePetSkill({
    name: 'Takedown',
    description: 'Cripple your target with a powerful strike.',
    icon: 'https://render.guildwars2.com/file/1B7A03496B93AEC937923F229E062F2AD14DFA24/1128611.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Smokescale'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 10,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SMOKESCALE_TAKEDOWN]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SMOKESCALE_TAKEDOWN]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  // Natural Smoke Assault uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.SMOKESCALE_SMOKE_ASSAULT]: definePetSkill({
    name: 'Smoke Assault',
    description: 'Conceal yourself and lash out at nearby foes. Gain might each time you damage a foe.',
    icon: 'https://render.guildwars2.com/file/9B9A0403F90E7C7C2367F2995923477F67B0077F/1128612.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Smokescale'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SMOKESCALE_SMOKE_ASSAULT]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SMOKESCALE_SMOKE_ASSAULT]!.quicknessCastTimeMs,
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
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 8,
        stacks: 5,
        audience: {
          recipients: RECIPIENT.SELF
        },
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.SMOKE_CLOUD]: definePetSkill({
    name: 'Smoke Cloud',
    description: 'Beast. Create a cloud of smoke for the smokescale to hide in.',
    icon: 'https://render.guildwars2.com/file/B4AF20E830E205E81027A50663C275F2F920C32F/1128613.png',
    petNames: ['Smokescale'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 500,
    // The pet's persistent field lets ranger leap/blast finishers grant ordinary stealth.
    comboFields: [
      {
        ownerId: 'ranger',
        ownerActorType: ACTOR.SUMMON,
        fieldType: COMBO_FIELD.SMOKE,
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    effects: []
  })
});

/**
 * Owns Core Ranger pet skill definitions for the Avian family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, BOON, COMBO_FINISHER, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_AVIAN_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.BIRD_SLASH]: definePetSkill({
    name: 'Slash',
    description: 'Slash your foe.',
    icon: new URL('@images/wiki/slash-bird.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Hawk', 'Raven', 'Owl', 'Eagle', 'White Raven'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BIRD_SLASH]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BIRD_SLASH]!.quicknessCastTimeMs,
    // EVTC separates the claw contacts by about 80 ms, despite the wiki describing simultaneous hits.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [280, 360].map((atMs) => ({ atMs, coefficient: 0.38 })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  }),
  [ID.BIRD_SWOOP]: definePetSkill({
    name: 'Swoop',
    description: 'Swoop at your foe, making them vulnerable.',
    icon: 'https://render.guildwars2.com/file/FCCA3C61C308E1D625C70BD4CCB9F05051AE6F6F/104047.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Hawk', 'Raven', 'Owl', 'Eagle', 'White Raven'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 8,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BIRD_SWOOP]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BIRD_SWOOP]!.quicknessCastTimeMs,
    // The live pet applies one Vulnerability despite the tooltip advertising five.
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.66,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        comboFinishers: [{ ownerId: 'ranger', finisherType: COMBO_FINISHER.LEAP }]
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 6,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  }),
  [ID.QUICKENING_SCREECH_PET]: definePetSkill({
    name: 'Quickening Screech',
    description: 'Grant swiftness to nearby allies and remove movement-impairing conditions from them.',
    icon: 'https://render.guildwars2.com/file/69F1291534027E0937A5C020FFEBCC96F301EC54/104048.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Hawk', 'Raven', 'Owl', 'Eagle', 'White Raven'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.QUICKENING_SCREECH_PET]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.QUICKENING_SCREECH_PET]!.quicknessCastTimeMs,
    // The pet supplies this party boon, so its duration uses pet concentration rather than the ranger's gear.
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 10,
        stacks: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ])
  }),
  [ID.BLINDING_SLASH]: definePetSkill({
    name: 'Blinding Slash',
    description: 'Beast. Blind your foes with a slash.',
    icon: 'https://render.guildwars2.com/file/6A3CA8D32FDD9EB0A8546FDC4DB39FA8EE740059/104049.png',
    petNames: ['Raven', 'White Raven'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 18,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 2,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.CHILLING_SLASH]: definePetSkill({
    name: 'Chilling Slash',
    description: 'Beast. Slash your foes and chill them.',
    icon: 'https://render.guildwars2.com/file/6A3CA8D32FDD9EB0A8546FDC4DB39FA8EE740059/104049.png',
    petNames: ['Owl'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 2,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.BRASH_SLASH]: definePetSkill({
    name: 'Brash Slash',
    description: 'Beast. Slash your foes, inflicting weakness.',
    icon: 'https://render.guildwars2.com/file/6A3CA8D32FDD9EB0A8546FDC4DB39FA8EE740059/104049.png',
    petNames: ['Eagle'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 2,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.LACERATING_SLASH]: definePetSkill({
    name: 'Lacerating Slash',
    description: 'Beast. Slash your foes and cause them to bleed.',
    icon: 'https://render.guildwars2.com/file/6A3CA8D32FDD9EB0A8546FDC4DB39FA8EE740059/104049.png',
    petNames: ['Hawk'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.LACERATING_SLASH]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.LACERATING_SLASH]!.quicknessCastTimeMs,
    // Contacts remain about 80 ms apart, and each applies three bleeding stacks.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [280, 360].map((atMs) => ({ atMs, coefficient: 1 })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        ticks: [280, 360].map((atMs) => ({ atMs, condition: CONDITION.BLEEDING, stacks: 3, duration: 15 })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  })
});

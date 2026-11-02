/**
 * Owns Core Ranger pet skill definitions for the Turtle family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, BOON, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_TURTLE_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  // Natural Jade Cannon uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.TURTLE_JADE_CANNON]: definePetSkill({
    name: 'Jade Cannon',
    icon: new URL('@images/wiki/jade-cannon-turtle.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Siege Turtle'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.TURTLE_JADE_CANNON]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.TURTLE_JADE_CANNON]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.53,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        projectile: true
      }
    ]
  }),
  // Natural Heavy Shot uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.TURTLE_HEAVY_SHOT]: definePetSkill({
    name: 'Heavy Shot',
    icon: new URL('@images/wiki/heavy-shot.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Siege Turtle'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.TURTLE_HEAVY_SHOT]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.TURTLE_HEAVY_SHOT]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        projectile: true
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  // Natural Slam uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.TURTLE_SLAM]: definePetSkill({
    name: 'Slam',
    icon: 'https://render.guildwars2.com/file/42093A336F337E45FD91B058E12864E738D83E42/2604868.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Siege Turtle'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 25,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.TURTLE_SLAM]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.TURTLE_SLAM]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.1,
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
  [ID.HUNKER_DOWN]: definePetSkill({
    name: 'Hunker Down',
    icon: 'https://render.guildwars2.com/file/1D4ED81A5F0B21CABCD005C79A49E471F653A5CA/2604867.png',
    petNames: ['Siege Turtle'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 30,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.PROTECTION,
        duration: 2,
        stacks: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  })
};

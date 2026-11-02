/**
 * Owns Core Ranger pet skill definitions for the Chak family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_CHAK_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  // Natural Unleash Energy uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.CHAK_UNLEASH_ENERGY]: definePetSkill({
    name: 'Unleash Energy',
    icon: new URL('@images/wiki/unleash-energy.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Sky-Chak Striker'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CHAK_UNLEASH_ENERGY]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CHAK_UNLEASH_ENERGY]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.425,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        projectile: true
      }
    ]
  }),
  // Natural Electrocute uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.CHAK_ELECTROCUTE]: definePetSkill({
    name: 'Electrocute',
    icon: 'https://render.guildwars2.com/file/5C800D284EF75CA76EE34868E35FEFD3F7964E22/3256377.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Sky-Chak Striker'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 12,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CHAK_ELECTROCUTE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CHAK_ELECTROCUTE]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.67,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        projectile: true
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 8,
        duration: 8,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  // Natural Spit Goop uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.CHAK_SPIT_GOOP]: definePetSkill({
    name: 'Spit Goop',
    icon: 'https://render.guildwars2.com/file/43EE71676B2773FF9EA57A14653EEA3FFE32B0BF/3256379.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Sky-Chak Striker'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CHAK_SPIT_GOOP]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CHAK_SPIT_GOOP]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        projectile: true
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 2.5,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.LEY_ENERGY_PULSE]: definePetSkill({
    name: 'Ley Energy Pulse',
    icon: 'https://render.guildwars2.com/file/2FB236242D79B109DC0CF6D6BC64DE0738805C69/3256378.png',
    petNames: ['Sky-Chak Striker'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  })
};

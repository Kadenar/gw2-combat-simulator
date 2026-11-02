/**
 * Owns Core Ranger pet skill definitions for the Raptor Swiftwing family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_RAPTOR_SWIFTWING_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.RAPTOR_SWIFTWING_CLAW]: definePetSkill({
    name: 'Claw',
    icon: new URL('@images/wiki/claw-raptor-swiftwing.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Raptor Swiftwing'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.RAPTOR_SWIFTWING_CLAW]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.RAPTOR_SWIFTWING_CLAW]!.quicknessCastTimeMs,
    // The paired logs place Claw's first Quickness contact earlier while both contacts retain one pet activation.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [440, 680].map((atMs) => ({ atMs, coefficient: 0.2165 })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  }),
  [ID.RAPTOR_SWIFTWING_SAURIAN_MIGHT]: definePetSkill({
    name: 'Saurian Might',
    icon: 'https://render.guildwars2.com/file/6A21666A796F0FCC59C513DAEAF6073161034004/3713166.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Raptor Swiftwing'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 10,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.RAPTOR_SWIFTWING_SAURIAN_MIGHT]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.RAPTOR_SWIFTWING_SAURIAN_MIGHT]!.quicknessCastTimeMs,
    // The ground strike applies four eight-second bleeds; the skill name does not imply a Might boon.
    effects: impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.75, source: 'ranger-pet', actorType: ACTOR.SUMMON },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 4,
        duration: 8,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  }),
  [ID.RAPTOR_SWIFTWING_LEAPING_LIZARD]: definePetSkill({
    name: 'Leaping Lizard',
    icon: 'https://render.guildwars2.com/file/4BACB4F4A1A9BABF560CDF59A9016CDEB516E571/3713167.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Raptor Swiftwing'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 15,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.RAPTOR_SWIFTWING_LEAPING_LIZARD]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.RAPTOR_SWIFTWING_LEAPING_LIZARD]!.quicknessCastTimeMs,
    // Landing deals pet-owned damage and applies cripple before the movement recovery finishes.
    effects: impactEffects({ atMs: 1240, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1, source: 'ranger-pet', actorType: ACTOR.SUMMON },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 4,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  }),
  [ID.PIERCING_SHRIEK]: definePetSkill({
    name: 'Piercing Shriek',
    icon: 'https://render.guildwars2.com/file/BE0815D3CBB5740A0834BBE067BCD2C276D6AFAB/3713168.png',
    petNames: ['Raptor Swiftwing'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PIERCING_SHRIEK]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PIERCING_SHRIEK]!.quicknessCastTimeMs,
    // Shriek's daze and torment accompany its pet-owned strike so control-triggered traits can resolve.
    // Retain the API coefficient: the unquickened sample's lower damage does not isolate a scaling change.
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.25,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 2,
        duration: 8,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      { type: 'control', controlKind: CONTROL.DAZE, source: 'ranger-pet', actorType: ACTOR.SUMMON }
    ])
  })
};

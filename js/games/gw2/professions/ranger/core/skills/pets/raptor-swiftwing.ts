/**
 * Owns Core Ranger pet skill fragments for the Raptor Swiftwing family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_RAPTOR_SWIFTWING_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze(
  {
    [ID.RAPTOR_SWIFTWING_CLAW]: {
      petSkill: true,
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
    },
    [ID.RAPTOR_SWIFTWING_SAURIAN_MIGHT]: {
      petSkill: true,
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
    },
    [ID.RAPTOR_SWIFTWING_LEAPING_LIZARD]: {
      petSkill: true,
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
    },
    [ID.PIERCING_SHRIEK]: {
      petSkill: true,
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
    }
  }
);

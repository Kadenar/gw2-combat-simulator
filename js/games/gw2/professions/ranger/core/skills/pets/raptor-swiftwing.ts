/**
 * Owns Core Ranger pet skill fragments for the Raptor Swiftwing family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const RANGER_CORE_RAPTOR_SWIFTWING_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze(
  {
    [ID.RAPTOR_SWIFTWING_CLAW]: {
      // Claw makes two separate contacts using the same pet-owned activation.
      effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          ticks: [480, 680].map((atMs) => ({ atMs, coefficient: 0.2165 })),
          source: 'ranger-pet',
          actorType: 'summon'
        }
      ]),
      castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.RAPTOR_SWIFTWING_CLAW]!.castTimeMs,
      quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.RAPTOR_SWIFTWING_CLAW]!.quicknessCastTimeMs,
      petSkill: true
    },
    [ID.RAPTOR_SWIFTWING_SAURIAN_MIGHT]: {
      // The ground strike applies four eight-second bleeds; the skill name does not imply a Might boon.
      effects: impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        { type: 'strike', coefficient: 0.75, source: 'ranger-pet', actorType: 'summon' },
        { type: 'condition', condition: 'Bleeding', stacks: 4, duration: 8, source: 'ranger-pet', actorType: 'summon' }
      ]),
      castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.RAPTOR_SWIFTWING_SAURIAN_MIGHT]!.castTimeMs,
      quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.RAPTOR_SWIFTWING_SAURIAN_MIGHT]!.quicknessCastTimeMs,
      petSkill: true
    },
    [ID.RAPTOR_SWIFTWING_LEAPING_LIZARD]: {
      // Landing deals pet-owned damage and applies cripple before the movement recovery finishes.
      effects: impactEffects({ atMs: 1240, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        { type: 'strike', coefficient: 1, source: 'ranger-pet', actorType: 'summon' },
        { type: 'condition', condition: 'Crippled', stacks: 1, duration: 4, source: 'ranger-pet', actorType: 'summon' }
      ]),
      castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.RAPTOR_SWIFTWING_LEAPING_LIZARD]!.castTimeMs,
      quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.RAPTOR_SWIFTWING_LEAPING_LIZARD]!.quicknessCastTimeMs,
      petSkill: true
    },
    [ID.PIERCING_SHRIEK]: {
      // Shriek's daze and torment accompany its pet-owned strike so control-triggered traits can resolve.
      // Retain the API coefficient: the unquickened sample's lower damage does not isolate a scaling change.
      effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.25,
          hits: 1,
          source: 'ranger-pet',
          actorType: 'summon'
        },
        {
          type: 'condition',
          condition: 'Torment',
          stacks: 2,
          duration: 8,
          source: 'ranger-pet',
          actorType: 'summon'
        },
        { type: 'control', controlKind: 'daze', source: 'ranger-pet', actorType: 'summon' }
      ]),
      castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PIERCING_SHRIEK]!.castTimeMs,
      quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PIERCING_SHRIEK]!.quicknessCastTimeMs,
      petSkill: true
    }
  }
);

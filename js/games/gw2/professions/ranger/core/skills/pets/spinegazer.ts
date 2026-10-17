import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
/**
 * Owns Core Ranger pet skill fragments for the Spinegazer family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const RANGER_CORE_SPINEGAZER_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Natural Evil Eye uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.SPINEGAZER_EVIL_EYE]: {
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
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPINEGAZER_EVIL_EYE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPINEGAZER_EVIL_EYE]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Tormenting Visions uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.SPINEGAZER_TORMENTING_VISIONS]: {
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
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPINEGAZER_TORMENTING_VISIONS]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPINEGAZER_TORMENTING_VISIONS]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Staring Void uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.SPINEGAZER_STARING_VOID]: {
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
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPINEGAZER_STARING_VOID]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SPINEGAZER_STARING_VOID]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.PANOPTICON]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ],
    quicknessCastTimeMs: 667,
    petSkill: true
  }
});

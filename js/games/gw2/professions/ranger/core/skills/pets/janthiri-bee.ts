/**
 * Owns Core Ranger pet skill fragments for the Janthiri Bee family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_JANTHIRI_BEE_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Natural Nibble uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.JANTHIRI_BEE_NIBBLE]: {
    petSkill: true,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.JANTHIRI_BEE_NIBBLE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.JANTHIRI_BEE_NIBBLE]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.25,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  // Natural Bumble uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.JANTHIRI_BEE_BUMBLE]: {
    petSkill: true,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.JANTHIRI_BEE_BUMBLE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.JANTHIRI_BEE_BUMBLE]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'control',
        controlKind: CONTROL.KNOCKDOWN,
        duration: 3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  // Natural Stinging Sorrow uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.JANTHIRI_BEE_STINGING_SORROW]: {
    petSkill: true,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.JANTHIRI_BEE_STINGING_SORROW]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.JANTHIRI_BEE_STINGING_SORROW]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 4,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 4,
        duration: 7,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  [ID.HONEY_TOSS]: {
    petSkill: true,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.SLOW,
        stacks: 1,
        duration: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }
});

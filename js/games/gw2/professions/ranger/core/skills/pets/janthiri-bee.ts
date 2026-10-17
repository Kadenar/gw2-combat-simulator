import { ACTOR, CONTROL, CONDITION } from '#gw2/platform/constants.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
/**
 * Owns Core Ranger pet skill fragments for the Janthiri Bee family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const RANGER_CORE_JANTHIRI_BEE_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Natural Nibble uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.JANTHIRI_BEE_NIBBLE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.25,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.JANTHIRI_BEE_NIBBLE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.JANTHIRI_BEE_NIBBLE]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Bumble uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.JANTHIRI_BEE_BUMBLE]: {
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
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.JANTHIRI_BEE_BUMBLE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.JANTHIRI_BEE_BUMBLE]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Stinging Sorrow uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.JANTHIRI_BEE_STINGING_SORROW]: {
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
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.JANTHIRI_BEE_STINGING_SORROW]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.JANTHIRI_BEE_STINGING_SORROW]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.HONEY_TOSS]: {
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
    ],
    quicknessCastTimeMs: 500,
    petSkill: true
  }
});

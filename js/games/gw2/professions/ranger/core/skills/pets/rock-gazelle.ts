import { ACTOR, COMBO_FINISHER, CONTROL, CONDITION } from '#gw2/platform/constants.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
/**
 * Owns Core Ranger pet skill fragments for the Rock Gazelle family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const RANGER_CORE_ROCK_GAZELLE_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Natural Headbutt uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.ROCK_GAZELLE_HEADBUTT]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.415,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.ROCK_GAZELLE_HEADBUTT]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.ROCK_GAZELLE_HEADBUTT]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Kick uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.ROCK_GAZELLE_KICK]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.55,
        hits: 5,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 5,
        duration: 8,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.ROCK_GAZELLE_KICK]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.ROCK_GAZELLE_KICK]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Charge uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.ROCK_GAZELLE_CHARGE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        comboFinishers: [
          {
            ownerId: 'ranger',
            ownerActorType: ACTOR.SUMMON,
            finisherType: COMBO_FINISHER.LEAP
          }
        ]
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE,
        duration: 2,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.ROCK_GAZELLE_CHARGE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.ROCK_GAZELLE_CHARGE]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.HEAD_TOSS]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.11,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ],
    quicknessCastTimeMs: 500,
    petSkill: true
  }
});

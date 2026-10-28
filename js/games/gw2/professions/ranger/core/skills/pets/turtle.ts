/**
 * Owns Core Ranger pet skill fragments for the Turtle family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, BOON, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_TURTLE_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Natural Jade Cannon uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.TURTLE_JADE_CANNON]: {
    petSkill: true,
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
  },
  // Natural Heavy Shot uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.TURTLE_HEAVY_SHOT]: {
    petSkill: true,
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
        duration: 2,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  // Natural Slam uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.TURTLE_SLAM]: {
    petSkill: true,
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
        duration: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  [ID.HUNKER_DOWN]: {
    petSkill: true,
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
  }
});

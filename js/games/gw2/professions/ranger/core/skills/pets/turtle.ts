import { ACTOR, CONTROL, RECIPIENT, BOON } from '#gw2/platform/constants.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
/**
 * Owns Core Ranger pet skill fragments for the Turtle family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const RANGER_CORE_TURTLE_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Natural Jade Cannon uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.TURTLE_JADE_CANNON]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.53,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        projectile: true
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.TURTLE_JADE_CANNON]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.TURTLE_JADE_CANNON]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Heavy Shot uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.TURTLE_HEAVY_SHOT]: {
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
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.TURTLE_HEAVY_SHOT]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.TURTLE_HEAVY_SHOT]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Slam uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.TURTLE_SLAM]: {
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
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.TURTLE_SLAM]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.TURTLE_SLAM]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.HUNKER_DOWN]: {
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
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  }
});

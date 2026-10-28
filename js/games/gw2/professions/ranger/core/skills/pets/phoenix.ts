/**
 * Owns Core Ranger pet skill fragments for the Phoenix family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_PHOENIX_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Natural Wicked Bite uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.PHOENIX_WICKED_BITE]: {
    petSkill: true,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PHOENIX_WICKED_BITE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PHOENIX_WICKED_BITE]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.43,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  // Natural Dash uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.PHOENIX_DASH]: {
    petSkill: true,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PHOENIX_DASH]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PHOENIX_DASH]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  // Natural Wing Buffet uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.PHOENIX_WING_BUFFET]: {
    petSkill: true,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PHOENIX_WING_BUFFET]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PHOENIX_WING_BUFFET]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
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
  [ID.GALE_BREATH]: {
    petSkill: true,
    quicknessCastTimeMs: 667,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }
});

import { ACTOR, RECIPIENT, COMBO_FIELD, BOON, CONDITION } from '#gw2/platform/constants.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
/**
 * Owns Core Ranger pet skill fragments for the Smokescale family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const RANGER_CORE_SMOKESCALE_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Natural Bite uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.SMOKESCALE_BITE]: {
    petSkill: true,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SMOKESCALE_BITE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SMOKESCALE_BITE]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.56,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  // Natural Takedown uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.SMOKESCALE_TAKEDOWN]: {
    petSkill: true,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SMOKESCALE_TAKEDOWN]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SMOKESCALE_TAKEDOWN]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  // Natural Smoke Assault uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.SMOKESCALE_SMOKE_ASSAULT]: {
    petSkill: true,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SMOKESCALE_SMOKE_ASSAULT]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.SMOKESCALE_SMOKE_ASSAULT]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 5,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 8,
        stacks: 5,
        audience: {
          recipients: RECIPIENT.SELF
        },
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  [ID.SMOKE_CLOUD]: {
    petSkill: true,
    quicknessCastTimeMs: 500,
    // The pet's persistent field lets ranger leap/blast finishers grant ordinary stealth.
    comboFields: [
      {
        ownerId: 'ranger',
        ownerActorType: ACTOR.SUMMON,
        fieldType: COMBO_FIELD.SMOKE,
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    effects: []
  }
});

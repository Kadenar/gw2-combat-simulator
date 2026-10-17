import { ACTOR, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
/**
 * Owns Core Ranger pet skill fragments for the Moa family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const RANGER_CORE_MOA_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Natural Peck uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.MOA_PECK]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.315,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.MOA_PECK]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.MOA_PECK]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Frenzied Attack uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.MOA_FRENZIED_ATTACK]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 4,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 8,
        duration: 10,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.MOA_FRENZIED_ATTACK]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.MOA_FRENZIED_ATTACK]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.PROTECTING_SCREECH]: {
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.PROTECTION,
        duration: 4,
        stacks: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ],
    quicknessCastTimeMs: 667,
    petSkill: true
  },
  [ID.DAZING_SCREECH]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.DAZING_SCREECH_ID_12709]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.FURIOUS_SCREECH]: {
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.FURY,
        duration: 15,
        stacks: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ],
    quicknessCastTimeMs: 667,
    petSkill: true
  }
});

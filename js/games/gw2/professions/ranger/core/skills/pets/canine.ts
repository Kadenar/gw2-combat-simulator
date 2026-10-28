/**
 * Owns Core Ranger pet skill fragments for the Canine family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { ACTOR, BOON, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_CORE_CANINE_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Natural Bite uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.CANINE_BITE]: {
    petSkill: true,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CANINE_BITE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CANINE_BITE]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.335,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  // Natural Crippling Leap uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.CANINE_CRIPPLING_LEAP]: {
    petSkill: true,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CANINE_CRIPPLING_LEAP]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CANINE_CRIPPLING_LEAP]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.67,
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
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 5,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  // Natural Brutal Charge uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.CANINE_BRUTAL_CHARGE]: {
    petSkill: true,
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CANINE_BRUTAL_CHARGE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CANINE_BRUTAL_CHARGE]!.quicknessCastTimeMs,
    effects: [
      {
        type: 'strike',
        coefficient: 0.67,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'control',
        controlKind: CONTROL.KNOCKDOWN,
        duration: 2,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  [ID.INTIMIDATING_HOWL]: {
    petSkill: true,
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        // Pet-owned immobilize follows the attack's applications and uses pet condition duration.
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 2,
        applications: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  [ID.CHILLING_HOWL]: {
    petSkill: true,
    quicknessCastTimeMs: 1000,
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
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  [ID.REGENERATE_FERN_HOUND]: {
    petSkill: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 6,
        stacks: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  [ID.HOWL_OF_THE_PACK]: {
    petSkill: true,
    quicknessCastTimeMs: 1000,
    effects: []
  },
  [ID.TERRIFYING_HOWL]: {
    petSkill: true,
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }
});

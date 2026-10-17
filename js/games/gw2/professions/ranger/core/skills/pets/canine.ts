import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
/**
 * Owns Core Ranger pet skill fragments for the Canine family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const RANGER_CORE_CANINE_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Natural Bite uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.CANINE_BITE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.335,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CANINE_BITE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CANINE_BITE]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Crippling Leap uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.CANINE_CRIPPLING_LEAP]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.67,
        source: 'ranger-pet',
        actorType: 'summon',
        comboFinishers: [
          {
            ownerId: 'ranger',
            ownerActorType: 'summon',
            finisherType: 'Leap'
          }
        ]
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 5,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CANINE_CRIPPLING_LEAP]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CANINE_CRIPPLING_LEAP]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Brutal Charge uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.CANINE_BRUTAL_CHARGE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.67,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'control',
        controlKind: 'knockdown',
        duration: 2,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CANINE_BRUTAL_CHARGE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.CANINE_BRUTAL_CHARGE]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.INTIMIDATING_HOWL]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        // Pet-owned immobilize follows the attack's applications and uses pet condition duration.
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2,
        applications: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.CHILLING_HOWL]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.REGENERATE_FERN_HOUND]: {
    effects: [
      {
        type: 'boon',
        audience: { recipients: 'party' as const, maximumRecipients: 5 },
        boon: 'regeneration',
        duration: 6,
        stacks: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.HOWL_OF_THE_PACK]: {
    effects: [],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.TERRIFYING_HOWL]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  }
});

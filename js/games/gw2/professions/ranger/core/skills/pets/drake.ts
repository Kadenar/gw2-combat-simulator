import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
/**
 * Owns Core Ranger pet skill fragments for the Drake family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const RANGER_CORE_DRAKE_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  // Natural Bite uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.DRAKE_BITE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.3425,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.DRAKE_BITE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.DRAKE_BITE]!.quicknessCastTimeMs,
    petSkill: true
  },
  // Natural Tail Swipe uses wiki PvE effects; the selected pet profile supplies its measured action cadence.
  [ID.DRAKE_TAIL_SWIPE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        source: 'ranger-pet',
        actorType: 'summon',
        comboFinishers: [
          {
            ownerId: 'ranger',
            ownerActorType: 'summon',
            finisherType: 'Blast'
          }
        ]
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 5,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.DRAKE_TAIL_SWIPE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.DRAKE_TAIL_SWIPE]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.FIRE_BREATH]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 5,
        atMs: 0,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 5,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.BOIL]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.INSECT_SWARM]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 5,
        atMs: 0,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 5,
        duration: 4,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.POISON_CLOUD]: {
    effects: [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 4,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.FROST_BREATH]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 5,
        atMs: 0,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 5,
        duration: 2,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.FROST_NOVA]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.2,
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
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.LIGHTNING_BREATH]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.6500000000000001,
        hits: 5,
        atMs: 0,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.ELECTROCUTE_ID_12699]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.SONIC_SHRIEK]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 5,
        atMs: 0,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 10,
        duration: 5,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 10,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.SONIC_BARRIER]: {
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true
  }
});

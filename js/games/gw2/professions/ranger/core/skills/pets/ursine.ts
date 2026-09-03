/**
 * Owns Core Ranger pet skill fragments for the Ursine family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const RANGER_CORE_URSINE_PET_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SHAKE_IT_OFF]: {
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.PURGE_CONDITIONS]: {
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.POISON_CLOUD_ID_12687]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.1,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
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
  [ID.POISONOUS_MAUL]: {
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
        condition: 'Poisoned',
        stacks: 1,
        duration: 12,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.ENFEEBLING_MAUL]: {
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
        condition: 'Weakness',
        stacks: 1,
        duration: 5,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.ENFEEBLING_ROAR]: {
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
        condition: 'Weakness',
        stacks: 1,
        duration: 4,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 833,
    petSkill: true
  },
  [ID.ICY_ROAR]: {
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
    quicknessCastTimeMs: 833,
    petSkill: true
  },
  [ID.ICY_MAUL]: {
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
  [ID.RENDING_MAUL]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.34,
        hits: 2,
        atMs: 0,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 4,
        duration: 6,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1167,
    petSkill: true
  }
});

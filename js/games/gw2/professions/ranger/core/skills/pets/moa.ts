/**
 * Owns Core Ranger pet skill fragments for the Moa family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const RANGER_CORE_MOA_PET_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.PROTECTING_SCREECH]: {
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 4,
        stacks: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 667,
    petSkill: true
  },
  [ID.ICY_SCREECH]: {
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.DAZING_SCREECH]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
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
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.FURIOUS_SCREECH]: {
    effects: [
      {
        type: 'boon',
        boon: 'fury',
        duration: 15,
        stacks: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 667,
    petSkill: true
  }
});

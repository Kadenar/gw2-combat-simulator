/**
 * Owns Core Ranger pet skill fragments for the Spider family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const RANGER_CORE_SPIDER_PET_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.DEADLY_VENOM]: {
    effects: [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 2,
        duration: 6,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.PARALYZING_VENOM]: {
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.WEAKENING_VENOM]: {
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 10,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 6,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.SPIT]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.57,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 833,
    petSkill: true
  }
});

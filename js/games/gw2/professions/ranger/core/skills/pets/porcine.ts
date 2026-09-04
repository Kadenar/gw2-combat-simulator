/**
 * Owns Core Ranger pet skill fragments for the Porcine family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const RANGER_CORE_PORCINE_PET_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.FORAGE_ROCK]: {
    effects: [],
    quicknessCastTimeMs: 667,
    petSkill: true
  },
  [ID.FORAGE_SCALE]: {
    effects: [],
    quicknessCastTimeMs: 667,
    petSkill: true
  },
  [ID.FORAGE_FEATHERS]: {
    effects: [],
    quicknessCastTimeMs: 667,
    petSkill: true
  },
  [ID.FORAGE_SWORD]: {
    effects: [],
    quicknessCastTimeMs: 667,
    petSkill: true
  },
  [ID.BLOODTHIRSTY_CHARGE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 8,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1167,
    petSkill: true
  }
});

/**
 * Owns Core Ranger pet skill fragments for the Turtle family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const RANGER_CORE_TURTLE_PET_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.HUNKER_DOWN]: {
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 2,
        stacks: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  }
});

/**
 * Owns Core Ranger pet skill fragments for the River Otter family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const RANGER_CORE_RIVER_OTTER_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.INNOCENT_DISPLAY]: {
    effects: [
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 3,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1167,
    petSkill: true
  }
});

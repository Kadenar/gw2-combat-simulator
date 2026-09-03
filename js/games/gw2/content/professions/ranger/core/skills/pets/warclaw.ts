/**
 * Owns Core Ranger pet skill fragments for the Warclaw family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const RANGER_CORE_WARCLAW_PET_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.RALLYING_ROAR]: {
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true
  }
});

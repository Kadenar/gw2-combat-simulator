/**
 * Owns Core Ranger pet skill fragments for the Smokescale family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const RANGER_CORE_SMOKESCALE_PET_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SMOKE_CLOUD]: {
    effects: [],
    quicknessCastTimeMs: 500,
    petSkill: true
  }
});

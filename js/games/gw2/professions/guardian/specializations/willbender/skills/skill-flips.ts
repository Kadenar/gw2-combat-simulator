/** Explicit Willbender follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const GUARDIAN_WILLBENDER_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.FLASH_COMBO, followUpId: ID.REPOSE },
  { parentId: ID.ROILING_LIGHT, followUpId: ID.QUICK_RETRIBUTION }
]);

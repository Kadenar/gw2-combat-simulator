/** Explicit Renegade follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';

export const REVENANT_RENEGADE_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.SOULCLEAVES_SUMMIT, followUpId: ID.DISMISS_LIEUTENANT_SOULCLEAVE }
]);

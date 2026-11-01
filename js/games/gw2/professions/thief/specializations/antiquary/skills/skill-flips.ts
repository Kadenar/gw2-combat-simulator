/** Explicit Antiquary follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

export const THIEF_ANTIQUARY_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.ANTIVENOM_DRAUGHT, followUpId: ID.ANTIVENOM_DRAUGHT_BACKFIRED }
]);

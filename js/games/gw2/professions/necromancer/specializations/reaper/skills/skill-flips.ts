/** Explicit Reaper follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

export const NECROMANCER_REAPER_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.INFUSING_TERROR, followUpId: ID.TERRIFY },
  { parentId: ID.REAPERS_SHROUD, followUpId: ID.EXIT_REAPERS_SHROUD }
]);

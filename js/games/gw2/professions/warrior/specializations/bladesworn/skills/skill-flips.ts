/** Explicit Bladesworn follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

export const WARRIOR_BLADESWORN_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.UNSHEATHE_GUNSABER, followUpId: ID.SHEATHE_GUNSABER }
]);

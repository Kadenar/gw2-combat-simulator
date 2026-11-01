/** Explicit Druid follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const RANGER_DRUID_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.CELESTIAL_AVATAR, followUpId: ID.RELEASE_CELESTIAL_AVATAR }
]);

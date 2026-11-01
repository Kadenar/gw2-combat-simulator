/** Explicit Core follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const GUARDIAN_CORE_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.ZEALOTS_FLAME, followUpId: ID.ZEALOTS_FIRE },
  { parentId: ID.SHIELD_OF_ABSORPTION, followUpId: ID.SHIELD_OF_ABSORPTION_ID_DETONATE },
  { parentId: ID.BINDING_BLADE, followUpId: ID.PULL }
]);

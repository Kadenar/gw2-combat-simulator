/** Explicit Dragonhunter follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const GUARDIAN_DRAGONHUNTER_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.SPEAR_OF_JUSTICE, followUpId: ID.HUNTERS_VERDICT }
]);

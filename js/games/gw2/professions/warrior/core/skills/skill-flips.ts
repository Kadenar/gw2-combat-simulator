/** Explicit Core follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

export const WARRIOR_CORE_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.IMPALE, followUpId: ID.RIP },
  { parentId: ID.COUNTERBLOW, followUpId: ID.TACTICAL_BLOW },
  { parentId: ID.RIPOSTE, followUpId: ID.ADRENALINE_RUSH }
]);

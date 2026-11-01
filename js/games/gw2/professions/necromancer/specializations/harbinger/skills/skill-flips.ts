/** Explicit Harbinger follow-ups; their owning mechanics control activation and expiry. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

export const NECROMANCER_HARBINGER_SKILL_FLIPS: SkillFlips = Object.freeze([
  { parentId: ID.HARBINGER_SHROUD, followUpId: ID.EXIT_HARBINGER_SHROUD }
]);
